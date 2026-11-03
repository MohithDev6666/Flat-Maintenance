package payments

import (
	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/handler"
)

func SetupPaymentRoutes(router *gin.RouterGroup, handler handler.PaymentHandler, require func(string) gin.HandlerFunc) {
	router.Use(require("payments:view"))
	router.GET("", handler.GetAllPaymentsHandler)
	router.GET("/:id", handler.GetPaymentByIDHandler)
	router.POST("", require("payments:add"), handler.CreatePaymentHandler)
	router.PUT("/:id", require("payments:edit"), handler.UpdatePaymentHandler)
	router.DELETE("/:id", require("payments:delete"), handler.DeletePaymentHandler)
	router.POST("/:id/flag", require("payments:edit"), handler.FlagPaymentHandler)
	router.DELETE("/:id/flag", require("payments:edit"), handler.ClearPaymentFlagHandler)
}
