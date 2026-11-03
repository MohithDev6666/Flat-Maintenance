package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/config"
	"github.com/trideadmin/flat-maintenance/backend/internal/db"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/routes"
	"github.com/trideadmin/rbac"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if err := logs.Init(cfg.LogDir); err != nil {
		log.Fatalf("Log setup failed: %v", err)
	}

	// Connect Mongo
	mongoClient, err := db.NewMongoDB(cfg.MongoURI)
	if err != nil {
		logs.ErrorLogger.Fatalf("MongoDB connection failed: %v", err)
	}
	logs.InfoLogger.Println("Connected to MongoDB")

	// Setup RBAC
	rbacService, err := rbac.NewWithMongo(mongoClient.Database(cfg.MongoDatabase), &rbac.Config{
		JWTSecretKey:   cfg.JWTSecret,
		JWTIssuer:      cfg.JWTIssuer,
		JWTExpiration:  cfg.JWTExpiration,
		InitialModules: routes.ApplicationModules(),
	})
	if err != nil {
		logs.ErrorLogger.Fatalf("RBAC setup failed: %v", err)
	}

	// Setup Gin
	router := gin.Default()
	if err := routes.RegisterRoutes(router, mongoClient, cfg.MongoDatabase, rbacService); err != nil {
		logs.ErrorLogger.Fatalf("Route setup failed: %v", err)
	}

	// HTTP server
	httpServer := &http.Server{
		Addr:         cfg.HTTPAddress,
		Handler:      router,
		ReadTimeout:  20 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logs.InfoLogger.Printf("Flat Maintenance API listening on %s", cfg.HTTPAddress)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logs.ErrorLogger.Fatalf("HTTP server failed: %v", err)
		}
	}()

	// Wait for interrupt signal (CTRL+C or container stop)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logs.InfoLogger.Println("Shutting down gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		logs.ErrorLogger.Printf("HTTP server forced to shutdown: %v", err)
	}
	if err := db.Close(mongoClient); err != nil {
		logs.ErrorLogger.Printf("MongoDB disconnect error: %v", err)
	}
	logs.InfoLogger.Println("Shutdown complete")
}
