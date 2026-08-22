import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import * as controller from "./auth.controller";
import { acceptInviteSchema, loginSchema } from "./auth.schema";

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     description: Returns an access token in the body and sets an httpOnly refreshToken cookie.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Login successful. Access token and user returned. Refresh token set as cookie.
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account not activated
 */
router.post("/login", validate(loginSchema), controller.login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Issue a new access token from the refreshToken cookie
 *     security: []
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Missing, invalid, expired, or revoked refresh token
 */
router.post("/refresh", controller.refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke the refresh token
 *     description: Requires a valid access token. Deletes the refresh token from the database and clears the cookie.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Missing or invalid access token
 */
router.post("/logout", authenticate, controller.logout);

/**
 * @openapi
 * /api/auth/accept-invite:
 *   post:
 *     tags: [Auth]
 *     summary: Activate an invited account by setting a password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password, confirmPassword]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Raw invite token from the email link
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account activated
 *       400:
 *         description: Invalid or expired invite link, or passwords do not match
 */
router.post("/accept-invite", validate(acceptInviteSchema), controller.acceptInvite);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the authenticated user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user without password
 *       401:
 *         description: Missing or invalid access token
 */
router.get("/me", authenticate, controller.me);

export default router;
