package routes

import (
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"

	audithandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/handler"
	auditrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/repo"
	auditroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/routes"
	auditservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/audit/service"

	buildinghandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/building/handler"
	buildingrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/building/repo"
	buildingroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/building/routes"
	buildingservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/building/service"

	categoryhandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/handler"
	categoryrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/repo"
	categoryroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/routes"
	categoryservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/categories/service"

	expensehandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/handler"
	expenserepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/repo"
	expenseroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/routes"
	expenseservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/expenses/service"

	flatmanagementhandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/flatmanagement/handler"
	flatmanagementroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/flatmanagement/routes"

	flathandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/handler"
	flatrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/repo"
	flatroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/routes"
	flatservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/flats/service"

	monthlockhandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/handler"
	monthlockrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/repo"
	monthlockroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/routes"
	monthlockservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/monthlocks/service"

	ownerhandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/handler"
	ownerrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/repo"
	ownerroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/routes"
	ownerservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/owners/service"

	paymenthandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/handler"
	paymentrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/repo"
	paymentroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/routes"
	paymentservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/payments/service"

	reporthandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/handler"
	reportrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/repo"
	reportroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/routes"
	reportservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/reports/service"

	tenanthandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/handler"
	tenantrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/repo"
	tenantroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/routes"
	tenantservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/tenants/service"

	userlinkhandler "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/handler"
	userlinkrepo "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/repo"
	userlinkroute "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/routes"
	userlinkservice "github.com/trideadmin/flat-maintenance/backend/internal/modules/userlinks/service"
)

func SetUpProtectedRoutes(r *gin.RouterGroup, client *mongo.Client, Database string, require func(string) gin.HandlerFunc, requireAny func(...string) gin.HandlerFunc) {
	// Repositories
	auditRepo := auditrepo.NewMongoAuditRepo(client, Database)
	buildingRepo := buildingrepo.NewMongoBuildingRepo(client, Database)
	flatRepo := flatrepo.NewMongoFlatsRepo(client, Database)
	ownerRepo := ownerrepo.NewMongoOwnersRepo(client, Database)
	tenantRepo := tenantrepo.NewMongoTenantsRepo(client, Database)
	categoryRepo := categoryrepo.NewMongoCategoriesRepo(client, Database)
	expenseRepo := expenserepo.NewMongoExpensesRepo(client, Database)
	paymentRepo := paymentrepo.NewMongoPaymentsRepo(client, Database)
	monthLockRepo := monthlockrepo.NewMongoMonthLocksRepo(client, Database)
	userLinkRepo := userlinkrepo.NewMongoUserLinksRepo(client, Database)
	reportRepo := reportrepo.NewMongoReportRepo(client, Database)

	userLinkService := userlinkservice.NewUserLinkService(userLinkRepo, ownerRepo, tenantRepo, auditRepo)
	userLinkHandler := userlinkhandler.NewUserLinksHandler(userLinkService)
	userlinkroute.SetupUserLinkRoutes(r, userLinkHandler, require)

	flatService := flatservice.NewFlatService(flatRepo, ownerRepo, tenantRepo, paymentRepo, auditRepo)
	flatHandler := flathandler.NewFlatsHandler(flatService)
	flatroute.SetupFlatRoutes(r.Group("/flats"), flatHandler, require)

	flatManagementHandler := flatmanagementhandler.NewFlatManagementHandler(flatService)
	flatmanagementroute.SetupFlatManagementRoutes(r.Group("/flat-management"), flatManagementHandler, require)

	buildingService := buildingservice.NewBuildingService(buildingRepo, auditRepo)
	buildingHandler := buildinghandler.NewBuildingHandler(buildingService)
	buildingroute.SetupBuildingRoutes(r.Group("/building"), buildingHandler, require)

	ownerService := ownerservice.NewOwnerService(ownerRepo, flatRepo, paymentRepo, userLinkRepo, auditRepo)
	ownerHandler := ownerhandler.NewOwnersHandler(ownerService)
	ownerroute.SetupOwnerRoutes(r.Group("/owners"), ownerHandler, require, requireAny)

	tenantService := tenantservice.NewTenantService(tenantRepo, flatRepo, paymentRepo, userLinkRepo, auditRepo)
	tenantHandler := tenanthandler.NewTenantsHandler(tenantService)
	tenantroute.SetupTenantRoutes(r.Group("/tenants"), tenantHandler, require, requireAny)

	categoryService := categoryservice.NewCategoryService(categoryRepo, expenseRepo, auditRepo)
	categoryHandler := categoryhandler.NewCategoriesHandler(categoryService)
	categoryroute.SetupCategoryRoutes(r.Group("/categories"), categoryHandler, require, requireAny)

	expenseService := expenseservice.NewExpenseService(expenseRepo, categoryRepo, monthLockRepo, ownerRepo, tenantRepo, auditRepo)
	expenseHandler := expensehandler.NewExpensesHandler(expenseService, userLinkService)
	expenseroute.SetupExpenseRoutes(r.Group("/expenses"), expenseHandler, require)

	paymentService := paymentservice.NewPaymentService(paymentRepo, flatRepo, ownerRepo, tenantRepo, monthLockRepo, auditRepo)
	paymentHandler := paymenthandler.NewPaymentsHandler(paymentService, userLinkService)
	paymentroute.SetupPaymentRoutes(r.Group("/payments"), paymentHandler, require)

	auditService := auditservice.NewAuditService(auditRepo, flatRepo, ownerRepo, tenantRepo)
	auditHandler := audithandler.NewAuditHandler(auditService)
	auditroute.SetupAuditRoutes(r.Group("/audit"), auditHandler, require)

	monthLockService := monthlockservice.NewMonthLockService(monthLockRepo, auditRepo)
	monthLockHandler := monthlockhandler.NewMonthLocksHandler(monthLockService)
	monthlockroute.SetupMonthLockRoutes(r.Group("/month-locks"), monthLockHandler, require, requireAny)

	reportService := reportservice.NewReportService(reportRepo)
	reportHandler := reporthandler.NewReportHandler(reportService, userLinkService)
	reportroute.SetupReportRoutes(r, reportHandler, require)
}
