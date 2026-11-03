package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	MongoURI      string
	MongoDatabase string
	HTTPAddress   string
	JWTSecret     string
	JWTIssuer     string
	JWTExpiration time.Duration
	LogDir        string
}

func Load() (Config, error) {
	if err := loadDotEnv(".env"); err != nil && !errors.Is(err, os.ErrNotExist) {
		return Config{}, fmt.Errorf("load .env: %w", err)
	}
	cfg := Config{
		MongoURI:      strings.TrimSpace(os.Getenv("MONGODB_URI")),
		MongoDatabase: strings.TrimSpace(os.Getenv("MONGODB_DATABASE")),
		HTTPAddress:   strings.TrimSpace(os.Getenv("HTTP_ADDRESS")),
		JWTSecret:     os.Getenv("JWT_SECRET"),
		JWTIssuer:     strings.TrimSpace(os.Getenv("JWT_ISSUER")),
		JWTExpiration: 24 * time.Hour,
		LogDir:        strings.TrimSpace(os.Getenv("LOG_DIR")),
	}
	if cfg.LogDir == "" {
		cfg.LogDir = "logs"
	}
	if cfg.MongoURI == "" {
		return Config{}, errors.New("MONGODB_URI is required in .env or the process environment")
	}
	if cfg.MongoDatabase == "" {
		return Config{}, errors.New("MONGODB_DATABASE is required in .env or the process environment")
	}
	if cfg.HTTPAddress == "" {
		cfg.HTTPAddress = ":8080"
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET is required in .env or the process environment")
	}
	if cfg.JWTIssuer == "" {
		cfg.JWTIssuer = "flat-maintenance"
	}
	if value := strings.TrimSpace(os.Getenv("JWT_EXPIRATION")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil || duration <= 0 {
			return Config{}, errors.New("JWT_EXPIRATION must be a positive Go duration")
		}
		cfg.JWTExpiration = duration
	}
	return cfg, nil
}

func loadDotEnv(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, value, found := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !found || key == "" {
			return fmt.Errorf("%s:%d: expected KEY=value", path, lineNumber)
		}
		value = strings.TrimSpace(value)
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') ||
			(value[0] == '\'' && value[len(value)-1] == '\'')) {
			value = value[1 : len(value)-1]
		} else if comment := strings.Index(value, " #"); comment >= 0 {
			value = strings.TrimSpace(value[:comment])
		}
		if _, exists := os.LookupEnv(key); !exists {
			if err := os.Setenv(key, value); err != nil {
				return fmt.Errorf("set %s from %s: %w", key, path, err)
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	return nil
}
