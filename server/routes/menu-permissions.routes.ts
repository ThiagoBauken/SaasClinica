import { Router } from "express";
import { db } from "../db";
import { menuPermissions, type InsertMenuPermission } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET - Buscar permissões por role e empresa
router.get("/by-role/:role", async (req, res) => {
  try {
    const { role } = req.params;
    const companyId = (req.user as any)?.companyId;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    const permissions = await db
      .select()
      .from(menuPermissions)
      .where(
        and(
          eq(menuPermissions.companyId, companyId),
          eq(menuPermissions.role, role)
        )
      )
      .orderBy(menuPermissions.order);

    res.json(permissions);
  } catch (error) {
    console.error("Erro ao buscar permissões:", error);
    res.status(500).json({ message: "Erro ao buscar permissões" });
  }
});

// GET - Buscar todas as permissões da empresa
router.get("/", async (req, res) => {
  try {
    const companyId = (req.user as any)?.companyId;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    const permissions = await db
      .select()
      .from(menuPermissions)
      .where(eq(menuPermissions.companyId, companyId))
      .orderBy(menuPermissions.role, menuPermissions.order);

    res.json(permissions);
  } catch (error) {
    console.error("Erro ao buscar permissões:", error);
    res.status(500).json({ message: "Erro ao buscar permissões" });
  }
});

// POST - Criar nova permissão
router.post("/", async (req, res) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const userRole = (req.user as any)?.role;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    // Apenas admins podem criar permissões
    if (userRole !== "admin" && userRole !== "superadmin") {
      return res.status(403).json({ message: "Permissão negada" });
    }

    const permission: InsertMenuPermission = {
      ...req.body,
      companyId,
    };

    const [newPermission] = await db
      .insert(menuPermissions)
      .values(permission)
      .returning();

    res.status(201).json(newPermission);
  } catch (error) {
    console.error("Erro ao criar permissão:", error);
    res.status(500).json({ message: "Erro ao criar permissão" });
  }
});

// PUT - Atualizar permissão
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = (req.user as any)?.companyId;
    const userRole = (req.user as any)?.role;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    // Apenas admins podem atualizar permissões
    if (userRole !== "admin" && userRole !== "superadmin") {
      return res.status(403).json({ message: "Permissão negada" });
    }

    const [updatedPermission] = await db
      .update(menuPermissions)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(menuPermissions.id, parseInt(id)),
          eq(menuPermissions.companyId, companyId)
        )
      )
      .returning();

    if (!updatedPermission) {
      return res.status(404).json({ message: "Permissão não encontrada" });
    }

    res.json(updatedPermission);
  } catch (error) {
    console.error("Erro ao atualizar permissão:", error);
    res.status(500).json({ message: "Erro ao atualizar permissão" });
  }
});

// DELETE - Deletar permissão
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = (req.user as any)?.companyId;
    const userRole = (req.user as any)?.role;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    // Apenas admins podem deletar permissões
    if (userRole !== "admin" && userRole !== "superadmin") {
      return res.status(403).json({ message: "Permissão negada" });
    }

    const [deletedPermission] = await db
      .delete(menuPermissions)
      .where(
        and(
          eq(menuPermissions.id, parseInt(id)),
          eq(menuPermissions.companyId, companyId)
        )
      )
      .returning();

    if (!deletedPermission) {
      return res.status(404).json({ message: "Permissão não encontrada" });
    }

    res.json({ message: "Permissão deletada com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar permissão:", error);
    res.status(500).json({ message: "Erro ao deletar permissão" });
  }
});

// POST - Popular com permissões padrão
router.post("/seed-defaults", async (req, res) => {
  try {
    const companyId = (req.user as any)?.companyId;
    const userRole = (req.user as any)?.role;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    // Apenas admins podem popular permissões
    if (userRole !== "admin" && userRole !== "superadmin") {
      return res.status(403).json({ message: "Permissão negada" });
    }

    // Permissões padrão para cada role
    const defaultPermissions: InsertMenuPermission[] = [
      // Admin - acesso total
      { companyId, role: "admin", menuItem: "schedule", label: "Agenda", path: "/schedule", icon: "Calendar", canView: true, canCreate: true, canEdit: true, canDelete: true, order: 1 },
      { companyId, role: "admin", menuItem: "patients", label: "Pacientes", path: "/patients", icon: "Users", canView: true, canCreate: true, canEdit: true, canDelete: true, order: 2 },
      { companyId, role: "admin", menuItem: "financial", label: "Financeiro", path: "/financial", icon: "DollarSign", canView: true, canCreate: true, canEdit: true, canDelete: true, order: 3 },
      { companyId, role: "admin", menuItem: "automation", label: "Automações", path: "/automation", icon: "Bot", canView: true, canCreate: true, canEdit: true, canDelete: true, order: 4 },
      { companyId, role: "admin", menuItem: "prosthesis", label: "Próteses", path: "/prosthesis", icon: "Scissors", canView: true, canCreate: true, canEdit: true, canDelete: true, order: 5 },
      { companyId, role: "admin", menuItem: "inventory", label: "Estoque", path: "/inventory", icon: "Package", canView: true, canCreate: true, canEdit: true, canDelete: true, order: 6 },

      // Dentist - acesso a agenda, pacientes e próteses (sem financeiro)
      { companyId, role: "dentist", menuItem: "schedule", label: "Agenda", path: "/schedule", icon: "Calendar", canView: true, canCreate: true, canEdit: true, canDelete: false, order: 1 },
      { companyId, role: "dentist", menuItem: "patients", label: "Pacientes", path: "/patients", icon: "Users", canView: true, canCreate: true, canEdit: true, canDelete: false, order: 2 },
      { companyId, role: "dentist", menuItem: "prosthesis", label: "Próteses", path: "/prosthesis", icon: "Scissors", canView: true, canCreate: true, canEdit: true, canDelete: false, order: 3 },
      { companyId, role: "dentist", menuItem: "inventory", label: "Estoque", path: "/inventory", icon: "Package", canView: true, canCreate: false, canEdit: false, canDelete: false, order: 4 },

      // Staff (Recepcionista) - acesso a agenda e pacientes (sem edição financeira)
      { companyId, role: "staff", menuItem: "schedule", label: "Agenda", path: "/schedule", icon: "Calendar", canView: true, canCreate: true, canEdit: true, canDelete: false, order: 1 },
      { companyId, role: "staff", menuItem: "patients", label: "Pacientes", path: "/patients", icon: "Users", canView: true, canCreate: true, canEdit: true, canDelete: false, order: 2 },
      { companyId, role: "staff", menuItem: "financial", label: "Financeiro", path: "/financial", icon: "DollarSign", canView: true, canCreate: false, canEdit: false, canDelete: false, order: 3 },
    ];

    // Inserir permissões padrão
    const insertedPermissions = await db
      .insert(menuPermissions)
      .values(defaultPermissions)
      .returning();

    res.status(201).json({
      message: "Permissões padrão criadas com sucesso",
      count: insertedPermissions.length,
      permissions: insertedPermissions,
    });
  } catch (error) {
    console.error("Erro ao popular permissões padrão:", error);
    res.status(500).json({ message: "Erro ao popular permissões padrão" });
  }
});

// PUT - Atualizar permissões em lote
router.put("/bulk-update", async (req, res) => {
  try {
    const { permissions } = req.body;
    const companyId = (req.user as any)?.companyId;
    const userRole = (req.user as any)?.role;

    if (!companyId) {
      return res.status(403).json({ message: "Empresa não encontrada" });
    }

    // Apenas admins podem atualizar permissões
    if (userRole !== "admin" && userRole !== "superadmin") {
      return res.status(403).json({ message: "Permissão negada" });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({ message: "Lista de permissões inválida" });
    }

    // Atualizar cada permissão
    const updatedPermissions = [];
    for (const permission of permissions) {
      const [updated] = await db
        .update(menuPermissions)
        .set({
          ...permission,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(menuPermissions.id, permission.id),
            eq(menuPermissions.companyId, companyId)
          )
        )
        .returning();

      if (updated) {
        updatedPermissions.push(updated);
      }
    }

    res.json({
      message: "Permissões atualizadas com sucesso",
      count: updatedPermissions.length,
      permissions: updatedPermissions,
    });
  } catch (error) {
    console.error("Erro ao atualizar permissões em lote:", error);
    res.status(500).json({ message: "Erro ao atualizar permissões em lote" });
  }
});

export default router;
