import express from "express";
import { UserController } from "./controller";
import { requireAuthorizedUser, requireInteractiveSession, requireRole } from "../../../middlewares/auth";

const initUserRoute: (controller: UserController) => express.Router = (
  controller
) => {
  const router = express.Router();

   //for admin
  router.route("/bulk-action").post(requireAuthorizedUser, requireRole("ADMIN"), controller.bulk.bind(controller));
  router.route("/:id/status").patch(requireAuthorizedUser, requireRole("ADMIN"), controller.setStatus.bind(controller));
  router
    .route("/update-profile")
    .patch(requireAuthorizedUser, controller.updateProfile.bind(controller));
  router
    .route("/upload-avatar")
    .post(requireAuthorizedUser, controller.uploadAvatar.bind(controller));
  router
    .route("/search")
    .post(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.searchUsersByNameAndEmail.bind(controller)
    );
  router
    .route("/filter")
    .post(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.filterUsers.bind(controller)
    );
  router.route("").post(requireAuthorizedUser, requireRole("ADMIN"), controller.createUser.bind(controller));
  router
    .route("")
    .get(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.getAllUsers.bind(controller)
    );
  router
    .route("/:id")
    .get(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.getUserById.bind(controller)
    );
  router
    .route("/:id")
    .patch(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.updateUserById.bind(controller)
    );
  router
    .route("/reset-password/:id")
    .put(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.resetPasswordById.bind(controller)
    );

  // Tự xoá tài khoản của mình (phải đặt trước "/:id"); token cá nhân (ssp_) không được dùng.
  router.route("/me").delete(requireAuthorizedUser, requireInteractiveSession, async (req: any, res) => {
    const r = await (controller as any).service.deleteOwnAccount(req.getSubject(), req.body?.password);
    if (r.ok) return void res.status(204).end();
    res.status(r.code === "WRONG_PASSWORD" ? 403 : r.code === "OWNS_PROJECTS" ? 409 : 404).json({ status: "Error", code: r.code, message: r.message });
  });

  router
    .route("/:id")
    .delete(
      requireAuthorizedUser,
      requireRole("ADMIN"),
      controller.deleteUserById.bind(controller)
    );

  //for user
  router
    .route("/change-email")
    .post(requireAuthorizedUser, controller.changeEmail.bind(controller));
  router
    .route("/change-password")
    .post(requireAuthorizedUser, controller.changePassword.bind(controller));

  return router;
};

export default initUserRoute;
