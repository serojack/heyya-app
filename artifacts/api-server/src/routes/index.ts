import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import roomsRouter from "./rooms";
import messagesRouter from "./messages";
import attendanceRouter from "./attendance";
import leaveRouter from "./leave";
import assistantRouter from "./assistant";
import paRouter from "./pa";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(roomsRouter);
router.use(messagesRouter);
router.use(attendanceRouter);
router.use(leaveRouter);
router.use(assistantRouter);
router.use(paRouter);

export default router;
