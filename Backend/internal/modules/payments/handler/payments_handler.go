package handler

import "github.com/gin-gonic/gin"

type PaymentHandler interface {
	GetAllPaymentsHandler(c *gin.Context)
	GetPaymentByIDHandler(c *gin.Context)
	CreatePaymentHandler(c *gin.Context)
	UpdatePaymentHandler(c *gin.Context)
	DeletePaymentHandler(c *gin.Context)
	FlagPaymentHandler(c *gin.Context)
	ClearPaymentFlagHandler(c *gin.Context)
}
