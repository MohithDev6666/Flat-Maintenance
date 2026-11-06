package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/trideadmin/flat-maintenance/backend/internal/logs"
	"github.com/trideadmin/flat-maintenance/backend/internal/models"
	"github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/service"
	userLinkService "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/service"
	"github.com/trideadmin/flat-maintenance/backend/internal/utils"
	"go.mongodb.org/mongo-driver/bson"
)

type ExpensesHandlerImpl struct {
	expenseService  service.ExpenseService
	userLinkService userLinkService.UserLinkService
}

func NewExpensesHandler(expenseService service.ExpenseService, userLinkService userLinkService.UserLinkService) ExpenseHandler {
	return &ExpensesHandlerImpl{
		expenseService:  expenseService,
		userLinkService: userLinkService,
	}
}

func (eh *ExpensesHandlerImpl) GetAllExpensesHandler(c *gin.Context) {
	limit, offset, filter, err := utils.ParseListQuery(c)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	// Expenses store a full YYYY-MM-DD date, so ?month=YYYY-MM matches the date prefix.
	if month, ok := filter["month"].(string); ok {
		delete(filter, "month")
		if _, err := time.Parse("2006-01", month); err != nil {
			utils.RespondError(c, utils.BadRequest("month must use YYYY-MM format"))
			return
		}
		filter["date"] = bson.M{"$regex": "^" + month + "-"}
	}
	data, err := eh.expenseService.GetAllExpenses(c, filter, limit, offset)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (eh *ExpensesHandlerImpl) GetExpenseByIDHandler(c *gin.Context) {
	data, err := eh.expenseService.GetExpenseByID(c, c.Param("id"))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (eh *ExpensesHandlerImpl) CreateExpenseHandler(c *gin.Context) {
	userID := utils.UserID(c)
	profile, admin, err := eh.userLinkService.ResolveResident(c, userID)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	var expense models.Expense
	if err := c.ShouldBindJSON(&expense); err != nil {
		logs.WarningLogger.Println("Invalid expense payload:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	if !admin {
		if err := eh.expenseService.ApplyResidentIdentity(c, profile, userID, &expense); err != nil {
			utils.RespondError(c, err)
			return
		}
	}
	data, err := eh.expenseService.CreateExpense(c, utils.Actor(c), &expense)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, data)
}

func (eh *ExpensesHandlerImpl) UpdateExpenseHandler(c *gin.Context) {
	userID := utils.UserID(c)
	profile, admin, err := eh.userLinkService.ResolveResident(c, userID)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	var expense models.Expense
	if err := c.ShouldBindJSON(&expense); err != nil {
		logs.WarningLogger.Println("Invalid expense payload for update:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid JSON object required"})
		return
	}
	if !admin {
		// Residents may only edit expenses they recorded themselves.
		old, err := eh.expenseService.GetExpenseByID(c, c.Param("id"))
		if err != nil {
			utils.RespondError(c, err)
			return
		}
		if utils.Deref(old.PaidByUserID) != userID {
			c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
			return
		}
		if err := eh.expenseService.ApplyResidentIdentity(c, profile, userID, &expense); err != nil {
			utils.RespondError(c, err)
			return
		}
	}
	data, err := eh.expenseService.UpdateExpense(c, utils.Actor(c), c.Param("id"), &expense)
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (eh *ExpensesHandlerImpl) DeleteExpenseHandler(c *gin.Context) {
	_, admin, err := eh.userLinkService.ResolveResident(c, utils.UserID(c))
	if err != nil {
		utils.RespondError(c, err)
		return
	}
	if !admin {
		c.JSON(http.StatusForbidden, gin.H{"error": "only administrators can delete expenses"})
		return
	}
	if err := eh.expenseService.DeleteExpense(c, utils.Actor(c), c.Param("id")); err != nil {
		utils.RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
