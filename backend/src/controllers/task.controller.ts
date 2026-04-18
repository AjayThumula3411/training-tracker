import { Response } from "express";
import { Priority, Role, TaskStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const developerRoles: Role[] = [Role.JUNIOR_DEV, Role.SENIOR_DEV];

const isDeveloper = (role: Role) => developerRoles.includes(role);
const isHr = (role: Role) => role === Role.HR;
const isTeamLead = (role: Role) => role === Role.TEAM_LEAD;
const isManager = (role: Role) => isHr(role) || isTeamLead(role);

const validPriorities = Object.values(Priority);

const formatStatus = (status: TaskStatus) =>
  status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getTaskWithRelations = (id: string) =>
  prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, role: true } },
      assignedBy: { select: { id: true, name: true, role: true } },
    },
  });

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { title, description, priority, dueDate, assignedToId } = req.body;
    const user = req.user;

    if (!isHr(user.role)) {
      return res.status(403).json({ message: "Only HR can create and assign tasks" });
    }

    if (!title?.trim() || !description?.trim() || !assignedToId) {
      return res.status(400).json({ message: "Title, description, and assigned developer are required" });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });

    if (!assignee || !assignee.isActive || !isDeveloper(assignee.role)) {
      return res.status(400).json({ message: "Tasks can only be assigned to developers" });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedToId,
        assignedById: user.id,
      },
    });

    await createNotification(assignedToId, `New task assigned: ${task.title}`);
    await createAuditLog("TASK_CREATED", "Task", user.id, task.id, {
      assignedToId,
      title: task.title,
      priority: task.priority,
    });

    const createdTask = await getTaskWithRelations(task.id);
    res.status(201).json(createdTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating task" });
  }
};

export const assignTask = createTask;

export const getAssignableDevelopers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!isHr(req.user.role)) {
      return res.status(403).json({ message: "Only HR can assign tasks" });
    }

    const developers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: developerRoles },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: { name: "asc" },
    });

    res.json(developers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error loading assignable developers" });
  }
};

export const getAllTasks = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const user = req.user;
    const whereClause = isDeveloper(user.role) ? { assignedToId: user.id } : {};

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
};

export const getTasksByDeveloper = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { developerId } = req.params;

    if (isDeveloper(req.user.role) && req.user.id !== developerId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const tasks = await prisma.task.findMany({
      where: { assignedToId: developerId },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
};

export const updateTaskDetails = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { title, description, priority, dueDate, assignedToId } = req.body;

    if (!isHr(req.user.role)) {
      return res.status(403).json({ message: "Only HR can edit task details" });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee || !assignee.isActive || !isDeveloper(assignee.role)) {
        return res.status(400).json({ message: "Tasks can only be assigned to developers" });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title?.trim() || existingTask.title,
        description: description?.trim() || existingTask.description,
        priority: priority || existingTask.priority,
        dueDate: dueDate === "" ? null : dueDate ? new Date(dueDate) : existingTask.dueDate,
        assignedToId: assignedToId || existingTask.assignedToId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (assignedToId && assignedToId !== existingTask.assignedToId) {
      await createNotification(assignedToId, `Task reassigned to you: ${updatedTask.title}`);
    }

    await createAuditLog("TASK_UPDATED", "Task", req.user.id, id, {
      before: {
        title: existingTask.title,
        description: existingTask.description,
        priority: existingTask.priority,
        dueDate: existingTask.dueDate,
        assignedToId: existingTask.assignedToId,
      },
      after: {
        title: updatedTask.title,
        description: updatedTask.description,
        priority: updatedTask.priority,
        dueDate: updatedTask.dueDate,
        assignedToId: updatedTask.assignedToId,
      },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating task" });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    if (!isHr(req.user.role)) {
      return res.status(403).json({ message: "Only HR can delete tasks" });
    }

    const existingTask = await prisma.task.findUnique({ where: { id } });

    if (!existingTask) {
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id } });
    await createNotification(existingTask.assignedToId, `Task removed: ${existingTask.title}`);
    await createAuditLog("TASK_DELETED", "Task", req.user.id, id, {
      title: existingTask.title,
      assignedToId: existingTask.assignedToId,
    });

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting task" });
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body as { status?: TaskStatus };
    const user = req.user;

    if (!status || !Object.values(TaskStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const developerTransitions: Record<TaskStatus, TaskStatus[]> = {
      ASSIGNED: [TaskStatus.IN_PROGRESS],
      IN_PROGRESS: [TaskStatus.SUBMITTED],
      SUBMITTED: [],
      NEEDS_REVISION: [TaskStatus.IN_PROGRESS],
      REVIEWED: [],
      COMPLETED: [],
    };

    const managerTransitions: Record<TaskStatus, TaskStatus[]> = {
      ASSIGNED: [],
      IN_PROGRESS: [],
      SUBMITTED: [TaskStatus.REVIEWED, TaskStatus.NEEDS_REVISION],
      NEEDS_REVISION: [],
      REVIEWED: [TaskStatus.COMPLETED],
      COMPLETED: [],
    };

    const isReviewAction =
      status === TaskStatus.REVIEWED ||
      status === TaskStatus.NEEDS_REVISION ||
      status === TaskStatus.COMPLETED;

    if (isDeveloper(user.role)) {
      if (task.assignedToId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!developerTransitions[task.status].includes(status)) {
        return res.status(400).json({
          message: `Developers cannot move task from ${task.status} to ${status}`,
        });
      }
    } else if (isManager(user.role)) {
      if (isReviewAction) {
        if (!managerTransitions[task.status].includes(status)) {
          return res.status(400).json({
            message: `${isHr(user.role) ? "HR" : "Team Lead"} cannot move task from ${task.status} to ${status}`,
          });
        }
      } else {
        return res.status(403).json({
          message: `${isHr(user.role) ? "HR" : "Team Lead"} can only review submitted work or complete reviewed work`,
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (status === TaskStatus.SUBMITTED) {
      await createNotification(task.assignedById, `Task submitted for review: ${task.title}`);
    }

    if (status === TaskStatus.REVIEWED) {
      await createNotification(task.assignedToId, `Task reviewed and ready to close: ${task.title}`);
      await createNotification(task.assignedById, `Task reviewed: ${task.title}`);
    }

    if (status === TaskStatus.NEEDS_REVISION) {
      await createNotification(task.assignedToId, `Task rejected for revision: ${task.title}`);
    }

    if (status === TaskStatus.COMPLETED) {
      await createNotification(task.assignedToId, `Task approved: ${task.title}`);
      await createNotification(task.assignedById, `Task approved: ${task.title}`);
    }

    await createAuditLog("TASK_STATUS_CHANGED", "Task", user.id, task.id, {
      from: task.status,
      to: status,
      label: formatStatus(status),
    });

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating status" });
  }
};
