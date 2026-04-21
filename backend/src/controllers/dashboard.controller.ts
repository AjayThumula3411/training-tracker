import { FeedbackType, Prisma, Role, TaskStatus } from "@prisma/client";
import { Response } from "express";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

const developerRoles: Role[] = [Role.JUNIOR_DEV, Role.SENIOR_DEV];

const average = (values: number[]) =>
  values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const taskWhere: Prisma.TaskWhereInput =
      user.role === Role.HR || user.role === Role.TEAM_LEAD ? {} : { assignedToId: user.id };

    const feedbackWhere: Prisma.FeedbackWhereInput =
      user.role === Role.HR || user.role === Role.TEAM_LEAD
        ? {}
        : {
            developerId: user.id,
            type: FeedbackType.EXTERNAL,
          };

    const userWhere: Prisma.UserWhereInput =
      user.role === Role.HR || user.role === Role.TEAM_LEAD
        ? { role: { in: developerRoles }, isActive: true }
        : { id: user.id, isActive: true };

    const [tasks, recentFeedback, feedbackCount, unreadNotifications, trackedUsers] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        include: {
          assignedTo: { select: { id: true, name: true, role: true } },
          assignedBy: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true, role: true } },
          updatedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.feedback.findMany({
        where: feedbackWhere,
        include: {
          author: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.feedback.count({
        where: feedbackWhere,
      }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
      prisma.user.findMany({
        where: userWhere,
        select: { trainingProgress: true },
      }),
    ]);

    const completedTasks = tasks.filter((task) => task.status === TaskStatus.COMPLETED).length;
    const pendingTasks = tasks.filter((task) => task.status !== TaskStatus.COMPLETED).length;
    const submittedTasks = tasks.filter((task) => task.status === TaskStatus.SUBMITTED).length;
    const pendingApprovals = tasks.filter((task) => task.status === TaskStatus.SUBMITTED).length;
    const statusOrder: TaskStatus[] = [
      TaskStatus.ASSIGNED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.SUBMITTED,
      TaskStatus.NEEDS_REVISION,
      TaskStatus.REVIEWED,
      TaskStatus.COMPLETED,
    ];

    const taskStatusBreakdown = statusOrder.map((status) => ({
      status,
      count: tasks.filter((task) => task.status === status).length,
    }));

    return res.json({
      role: user.role,
      metrics: {
        totalTasks: tasks.length,
        completedTasks,
        pendingTasks,
        submittedTasks,
        feedbackCount,
        pendingApprovals,
        unreadNotifications,
        trainingCompletionRate: average(trackedUsers.map((trackedUser) => trackedUser.trainingProgress)),
      },
      taskStatusBreakdown,
      recentTasks: tasks.slice(0, 5),
      recentFeedback,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching dashboard" });
  }
};
