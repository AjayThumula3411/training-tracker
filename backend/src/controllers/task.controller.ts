import { Response } from "express";
import { NotificationType, Priority, Role, TaskStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const developerRoles: Role[] = [Role.JUNIOR_DEV, Role.SENIOR_DEV];

const isDeveloper = (role: Role) => developerRoles.includes(role);
const isHr = (role: Role) => role === Role.HR;
const isTeamLead = (role: Role) => role === Role.TEAM_LEAD;
const isManager = (role: Role) => isHr(role) || isTeamLead(role);

const validPriorities = Object.values(Priority);
const validTaskStatuses = Object.values(TaskStatus);

const parseOptionalDate = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Due date must be a valid date");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Due date must be a valid date");
  }

  return parsed;
};

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
      createdBy: { select: { id: true, name: true, role: true } },
      updatedBy: { select: { id: true, name: true, role: true } },
    },
  });

const runSideEffect = async (label: string, effect: () => Promise<void>) => {
  try {
    await effect();
  } catch (error) {
    console.error(`${label} failed`, error);
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { title, description, priority, dueDate, assignedToId } = req.body;
    const user = req.user;

    if (!isManager(user.role)) {
      return res.status(403).json({ message: "Only HR and Team Lead can create and assign tasks" });
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
        dueDate: parseOptionalDate(dueDate),
        assignedToId,
        assignedById: user.id,
        createdById: user.id,
        updatedById: user.id,
      },
    });

    await runSideEffect("TASK_ASSIGNED notification", () =>
      createNotification(assignedToId, `New task assigned: ${task.title}`, NotificationType.TASK_ASSIGNED)
    );
    await runSideEffect("TASK_ASSIGNED audit log", () =>
      createAuditLog(
        "TASK_ASSIGNED",
        user.id,
        task.id,
        {
          assignedToId,
          title: task.title,
          priority: task.priority,
        },
        "Task"
      )
    );

    const createdTask = await getTaskWithRelations(task.id);
    res.status(201).json(createdTask);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Error creating task";
    res.status(message.includes("Due date") ? 400 : 500).json({ message });
  }
};

export const assignTask = createTask;

export const getAssignableDevelopers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!isManager(req.user.role)) {
      return res.status(403).json({ message: "Only HR and Team Lead can assign tasks" });
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
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
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
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
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
    const user = req.user;

    if (!isManager(user.role)) {
      return res.status(403).json({ message: "Only HR and Team Lead can edit task details" });
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
        dueDate: dueDate === undefined ? existingTask.dueDate : parseOptionalDate(dueDate),
        assignedToId: assignedToId || existingTask.assignedToId,
        updatedById: user.id,
      },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (assignedToId && assignedToId !== existingTask.assignedToId) {
      await runSideEffect("TASK_REASSIGNED notification", () =>
        createNotification(assignedToId, `New task assigned: ${updatedTask.title}`, NotificationType.TASK_ASSIGNED)
      );
    }

    await runSideEffect("TASK_UPDATED audit log", () =>
      createAuditLog(
        "TASK_UPDATED",
        user.id,
        id,
        {
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
        },
        "Task"
      )
    );

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Error updating task";
    res.status(message.includes("Due date") ? 400 : 500).json({ message });
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
    await createAuditLog(
      "TASK_DELETED",
      req.user.id,
      id,
      {
        title: existingTask.title,
        assignedToId: existingTask.assignedToId,
      },
      "Task"
    );

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting task" });
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { status: rawStatus, id: bodyTaskId } = req.body as { status?: string; id?: string };
    const id = req.params.id || bodyTaskId;
    const user = req.user;
    const status = rawStatus?.trim().toUpperCase() as TaskStatus | undefined;

    if (!id) {
      return res.status(400).json({ message: "Task id is required" });
    }

    if (!status || !validTaskStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    console.log("User Role:", user.role);
    console.log("Task Assigned To:", task.assignedToId);
    console.log("New Status:", status);

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
      REVIEWED: [TaskStatus.COMPLETED, TaskStatus.NEEDS_REVISION],
      COMPLETED: [],
    };

    if (isDeveloper(user.role)) {
      if (task.assignedToId !== user.id) {
        return res.status(403).json({ message: "Not your task" });
      }

      const developerAllowedStatuses: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED];

      if (!developerAllowedStatuses.includes(status)) {
        return res.status(403).json({ message: "Invalid status update" });
      }

      if (!developerTransitions[task.status].includes(status)) {
        return res.status(400).json({
          message: `Invalid transition from ${task.status} to ${status}`,
        });
      }
    } else if (isManager(user.role)) {
      if (!managerTransitions[task.status].includes(status)) {
        if (status === TaskStatus.IN_PROGRESS || status === TaskStatus.SUBMITTED) {
          return res.status(403).json({ message: "Invalid status update" });
        }

        return res.status(400).json({
          message: `Invalid transition from ${task.status} to ${status}`,
        });
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status, updatedById: user.id },
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        updatedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (status === TaskStatus.SUBMITTED) {
      await runSideEffect("TASK_SUBMITTED notification", () =>
        createNotification(task.assignedById, `Task submitted for review: ${task.title}`, NotificationType.TASK_SUBMITTED)
      );
    }

    if (status === TaskStatus.REVIEWED) {
      await runSideEffect("TASK_REVIEWED notification", () =>
        createNotification(task.assignedToId, `Task reviewed: ${task.title}`, NotificationType.TASK_REVIEWED)
      );
    }

    if (status === TaskStatus.NEEDS_REVISION) {
      await runSideEffect("TASK_NEEDS_REVISION notification", () =>
        createNotification(task.assignedToId, `Task marked needs revision: ${task.title}`, NotificationType.TASK_NEEDS_REVISION)
      );
    }

    if (status === TaskStatus.COMPLETED) {
      await runSideEffect("TASK_COMPLETED notification for assignee", () =>
        createNotification(task.assignedToId, `Task completed: ${task.title}`, NotificationType.TASK_COMPLETED)
      );
      await runSideEffect("TASK_COMPLETED notification for assigner", () =>
        createNotification(task.assignedById, `Task completed: ${task.title}`, NotificationType.TASK_COMPLETED)
      );
    }

    await runSideEffect("TASK_STATUS_CHANGED audit log", () =>
      createAuditLog(
        "TASK_STATUS_CHANGED",
        user.id,
        task.id,
        {
          from: task.status,
          to: status,
          label: formatStatus(status),
        },
        "Task"
      )
    );

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating status" });
  }
};
