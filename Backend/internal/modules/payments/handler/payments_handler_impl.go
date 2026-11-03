package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/service"
	userLinkService "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
)

type PaymentsHandlerImpl struct {
	paymentService  service.PaymentService
	userLinkService userLinkService.UserLinkService
}

func NewPaymentsHandler(paymentService service.PaymentService, userLinkService userLinkService.UserLinkService) PaymentHandler {
	return &PaymentsHandlerImpl{
		paymentService:  paymentService,
		userLinkService: userLinkService,
	}
}

func (ph *PaymentsHandlerImpl) GetAllPaymentsHandler(c *gin.Context) {
	profile, admin, err := ph.userLinkService.ResolveResident(c, utils.UserID(c))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	if !admin {
		if err := ph.paymentService.ScopeToResident(c, profile, filter); err != nil {
			utils.RespondError(c, err)
			return
		}
	}
	data, err := ph.paymentService.GetAllPayments(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (ph *PaymentsHandlerImpl) GetPaymentByIDHandler(c *gin.Context) {
	profile, admin, err := ph.userLinkService.ResolveResident(c, utils.UserID(c))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	data, err := ph.paymentService.GetPaymentByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	if !admin {
		matches, err := ph.paymentService.MatchesResident(c, profile, data)
		if err != nil {
			utils.RespondError(c, err)
			return
		}
		if !matches {
			c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
			return
		}
	}
	c.JSON(http.StatusOK, data)
}

func (ph *PaymentsHandlerImpl) CreatePaymentHandler(c *gin.Context) {
	profile, admin, err := ph.userLinkService.ResolveResident(c, utils.UserID(c))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		logs.WarningLogger.Println("Invalid payment payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	if !admin {
		if err := ph.paymentService.ApplyResidentIdentity(c, profile, &payment); err != nil {
			utils.RespondError(c, err)
			return
		}
	}
	data, err := ph.paymentService.CreatePayment(c, utils.Actor(c), &payment)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (ph *PaymentsHandlerImpl) UpdatePaymentHandler(c *gin.Context) {
	if !ph.requireAdmin(c, "only administrators can update payments") {
		return
	}
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		logs.WarningLogger.Println("Invalid payment payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	data, err := ph.paymentService.UpdatePayment(c, utils.Actor(c), c.Param("id"), &payment)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (ph *PaymentsHandlerImpl) DeletePaymentHandler(c *gin.Context) {
	if !ph.requireAdmin(c, "only administrators can delete payments") {
		return
	}
	if err := ph.paymentService.DeletePayment(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (ph *PaymentsHandlerImpl) FlagPaymentHandler(c *gin.Context) {
	if !ph.requireAdmin(c, "only administrators can review payments") {
		return
	}
	var request struct {
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		logs.WarningLogger.Println("Invalid payment flag payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON body required"})
		return
	}
	data, err := ph.paymentService.SetPaymentFlag(c, utils.Actor(c), c.Param("id"), true, request.Note)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (ph *PaymentsHandlerImpl) ClearPaymentFlagHandler(c *gin.Context) {
	if !ph.requireAdmin(c, "only administrators can review payments") {
		return
	}
	data, err := ph.paymentService.SetPaymentFlag(c, utils.Actor(c), c.Param("id"), false, "")
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

// requireAdmin writes a 403 with message unless the caller is an administrator.
func (ph *PaymentsHandlerImpl) requireAdmin(c *gin.Context, message string) bool {
	_, admin, err := ph.userLinkService.ResolveResident(c, utils.UserID(c))
	if err != nil {
		utils.RespondError(c, err)
		return false
	}
	if !admin {
		c.JSON(http.StatusForbidden, gin.H{"error": message})
		return false
	}
	return true
}
