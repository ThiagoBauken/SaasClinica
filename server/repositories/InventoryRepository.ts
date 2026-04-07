/**
 * InventoryRepository.ts
 * Handles all inventory-related database operations:
 * categories, items, transactions, standard dental products, and seeding.
 * Extracted from DatabaseStorage to improve maintainability.
 */

import {
  inventoryCategories,
  inventoryItems,
  inventoryTransactions,
  standardDentalProducts,
  users,
  type StandardDentalProduct,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { notDeleted } from "../lib/soft-delete";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Inventory Categories
// ---------------------------------------------------------------------------

export async function getInventoryCategories(companyId: number): Promise<any[]> {
  try {
    return db
      .select()
      .from(inventoryCategories)
      .where(eq(inventoryCategories.companyId, companyId))
      .orderBy(inventoryCategories.name);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar categorias de estoque:');
    return [];
  }
}

export async function createInventoryCategory(data: any): Promise<any> {
  try {
    const [result] = await db
      .insert(inventoryCategories)
      .values({
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        color: data.color,
      })
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar categoria de estoque:');
    throw error;
  }
}

export async function updateInventoryCategory(
  id: number,
  data: any,
  companyId: number
): Promise<any> {
  try {
    const [result] = await db
      .update(inventoryCategories)
      .set({ name: data.name, description: data.description, color: data.color })
      .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.companyId, companyId)))
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar categoria de estoque:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Inventory Items
// ---------------------------------------------------------------------------

export async function getInventoryItems(companyId: number): Promise<any[]> {
  try {
    return db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        description: inventoryItems.description,
        categoryId: inventoryItems.categoryId,
        categoryName: inventoryCategories.name,
        categoryColor: inventoryCategories.color,
        sku: inventoryItems.sku,
        barcode: inventoryItems.barcode,
        brand: inventoryItems.brand,
        supplier: inventoryItems.supplier,
        minimumStock: inventoryItems.minimumStock,
        currentStock: inventoryItems.currentStock,
        price: inventoryItems.price,
        unitOfMeasure: inventoryItems.unitOfMeasure,
        expirationDate: inventoryItems.expirationDate,
        location: inventoryItems.location,
        lastPurchaseDate: inventoryItems.lastPurchaseDate,
        active: inventoryItems.active,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .leftJoin(inventoryCategories, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(inventoryItems.companyId, companyId),
          eq(inventoryItems.active, true),
          notDeleted(inventoryItems.deletedAt)
        )
      )
      .orderBy(inventoryItems.name);
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar itens de estoque:');
    return [];
  }
}

export async function createInventoryItem(data: any): Promise<any> {
  try {
    const [result] = await db
      .insert(inventoryItems)
      .values({
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        sku: data.sku,
        barcode: data.barcode,
        brand: data.brand,
        supplier: data.supplier,
        minimumStock: data.minimumStock || 0,
        currentStock: data.currentStock || 0,
        price: data.price,
        unitOfMeasure: data.unitOfMeasure,
        expirationDate: data.expirationDate,
        location: data.location,
        lastPurchaseDate: data.lastPurchaseDate,
        active: data.active ?? true,
      })
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar item de estoque:');
    throw error;
  }
}

export async function updateInventoryItem(id: number, data: any, companyId: number): Promise<any> {
  try {
    const [result] = await db
      .update(inventoryItems)
      .set({
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        sku: data.sku,
        barcode: data.barcode,
        brand: data.brand,
        supplier: data.supplier,
        minimumStock: data.minimumStock,
        currentStock: data.currentStock,
        price: data.price,
        unitOfMeasure: data.unitOfMeasure,
        expirationDate: data.expirationDate,
        location: data.location,
        lastPurchaseDate: data.lastPurchaseDate,
        active: data.active,
        updatedAt: new Date(),
      })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.companyId, companyId)))
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar item de estoque:');
    throw error;
  }
}

export async function deleteInventoryItem(id: number, companyId: number): Promise<boolean> {
  try {
    await db
      .update(inventoryItems)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.companyId, companyId)));
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao deletar item de estoque:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Inventory Transactions
// ---------------------------------------------------------------------------

export async function getInventoryTransactions(
  companyId: number,
  itemId?: number
): Promise<any[]> {
  try {
    const whereConditions: any[] = [eq(inventoryItems.companyId, companyId)];
    if (itemId) {
      whereConditions.push(eq(inventoryTransactions.itemId, itemId));
    }

    return db
      .select({
        id: inventoryTransactions.id,
        itemId: inventoryTransactions.itemId,
        itemName: inventoryItems.name,
        userId: inventoryTransactions.userId,
        userName: users.fullName,
        type: inventoryTransactions.type,
        quantity: inventoryTransactions.quantity,
        reason: inventoryTransactions.reason,
        notes: inventoryTransactions.notes,
        previousStock: inventoryTransactions.previousStock,
        newStock: inventoryTransactions.newStock,
        appointmentId: inventoryTransactions.appointmentId,
        patientId: inventoryTransactions.patientId,
        createdAt: inventoryTransactions.createdAt,
      })
      .from(inventoryTransactions)
      .leftJoin(inventoryItems, eq(inventoryTransactions.itemId, inventoryItems.id))
      .leftJoin(users, eq(inventoryTransactions.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(inventoryTransactions.createdAt));
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar transações de estoque:');
    return [];
  }
}

export async function createInventoryTransaction(data: any): Promise<any> {
  try {
    const [result] = await db
      .insert(inventoryTransactions)
      .values({
        itemId: data.itemId,
        userId: data.userId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        notes: data.notes,
        previousStock: data.previousStock,
        newStock: data.newStock,
        appointmentId: data.appointmentId,
        patientId: data.patientId,
      })
      .returning();
    return result;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar transação de estoque:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Standard Dental Products
// ---------------------------------------------------------------------------

export async function getStandardDentalProducts(): Promise<StandardDentalProduct[]> {
  try {
    return db
      .select()
      .from(standardDentalProducts)
      .where(eq(standardDentalProducts.active, true))
      .orderBy(
        desc(standardDentalProducts.isPopular),
        standardDentalProducts.category,
        standardDentalProducts.name
      );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar produtos odontológicos padrão:');
    return [];
  }
}

export async function importStandardProducts(
  productIds: number[],
  companyId: number
): Promise<any[]> {
  try {
    const prods = await db
      .select()
      .from(standardDentalProducts)
      .where(
        and(inArray(standardDentalProducts.id, productIds), eq(standardDentalProducts.active, true))
      );

    const importedItems: any[] = [];

    for (const product of prods) {
      let category = await db
        .select()
        .from(inventoryCategories)
        .where(
          and(
            eq(inventoryCategories.companyId, companyId),
            eq(inventoryCategories.name, product.category)
          )
        )
        .limit(1);

      if (category.length === 0) {
        const [newCategory] = await db
          .insert(inventoryCategories)
          .values({
            companyId,
            name: product.category,
            description: `Categoria ${product.category}`,
            color: '#6B7280',
          })
          .returning();
        category = [newCategory];
      }

      const [item] = await db
        .insert(inventoryItems)
        .values({
          companyId,
          name: product.name,
          description: product.description,
          categoryId: category[0].id,
          brand: product.brand,
          unitOfMeasure: product.unitOfMeasure,
          price: product.estimatedPrice,
          minimumStock: 5,
          currentStock: 0,
          active: true,
        })
        .returning();

      importedItems.push(item);
    }

    return importedItems;
  } catch (error) {
    logger.error({ err: error }, 'Erro ao importar produtos padrão:');
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function getDefaultInventoryData() {
  const defaultCategories = [
    { name: 'Descartáveis e Consumo', description: 'Luvas, máscaras, algodão, gaze, sugadores, babadores', color: '#3B82F6' },
    { name: 'Anestésicos e Agulhas', description: 'Anestésicos locais, tubetes, agulhas gengivais', color: '#EF4444' },
    { name: 'Medicamentos', description: 'Anti-inflamatórios, antibióticos, analgésicos', color: '#DC2626' },
    { name: 'Materiais de Restauração', description: 'Resinas, adesivos, ionômeros, condicionadores', color: '#10B981' },
    { name: 'Cimentos Odontológicos', description: 'Cimentos resinosos, provisórios, ionômeros', color: '#059669' },
    { name: 'Materiais de Endodontia', description: 'Limas, cones, cimentos endodônticos, irrigantes', color: '#F59E0B' },
    { name: 'Materiais de Moldagem', description: 'Alginato, silicone, gesso, moldeiras', color: '#8B5CF6' },
    { name: 'Instrumentais Rotatórios', description: 'Brocas, pontas diamantadas, discos, polidores', color: '#EC4899' },
    { name: 'EPI e Biossegurança', description: 'Equipamentos de proteção, desinfetantes, esterilização', color: '#06B6D4' },
    { name: 'Material de Prótese', description: 'Ceras, resinas acrílicas, dentes, cimentos', color: '#84CC16' },
    { name: 'Cirurgia e Periodontia', description: 'Fios de sutura, lâminas, hemostáticos', color: '#7C3AED' },
    { name: 'Ortodontia', description: 'Bráquetes, fios, elásticos, ligaduras', color: '#F97316' },
    { name: 'Radiologia', description: 'Filmes, posicionadores, capas para sensor', color: '#64748B' },
    { name: 'Profilaxia e Prevenção', description: 'Pastas profiláticas, flúor, escovas', color: '#0EA5E9' },
  ];

  const defaultItemsByCategory: Record<string, Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }>> = {
    'Descartáveis e Consumo': [
      { name: 'Luva de Procedimento Látex P', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
      { name: 'Luva de Procedimento Látex M', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
      { name: 'Luva de Procedimento Látex G', minimumStock: 100, unitOfMeasure: 'unidade', brand: 'Supermax' },
      { name: 'Máscara Descartável Tripla', minimumStock: 100, unitOfMeasure: 'unidade' },
      { name: 'Algodão Rolete', minimumStock: 10, unitOfMeasure: 'pacote' },
      { name: 'Gaze Estéril 7,5x7,5', minimumStock: 20, unitOfMeasure: 'pacote' },
      { name: 'Sugador Descartável', minimumStock: 200, unitOfMeasure: 'unidade' },
      { name: 'Babador Descartável Impermeável', minimumStock: 100, unitOfMeasure: 'unidade' },
    ],
    'Anestésicos e Agulhas': [
      { name: 'Lidocaína 2% c/ Epinefrina 1:100.000', minimumStock: 50, unitOfMeasure: 'tubete', brand: 'DFL' },
      { name: 'Articaína 4% c/ Epinefrina 1:100.000', minimumStock: 50, unitOfMeasure: 'tubete', brand: 'DFL' },
      { name: 'Agulha Gengival Curta 30G', minimumStock: 100, unitOfMeasure: 'unidade' },
      { name: 'Agulha Gengival Longa 27G', minimumStock: 100, unitOfMeasure: 'unidade' },
    ],
    'Medicamentos': [
      { name: 'Ibuprofeno 600mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
      { name: 'Amoxicilina 500mg', minimumStock: 30, unitOfMeasure: 'cápsula' },
      { name: 'Paracetamol 750mg', minimumStock: 50, unitOfMeasure: 'comprimido' },
    ],
    'Materiais de Restauração': [
      { name: 'Resina Composta A2', minimumStock: 5, unitOfMeasure: 'seringa', brand: '3M Filtek' },
      { name: 'Resina Composta A3', minimumStock: 5, unitOfMeasure: 'seringa', brand: '3M Filtek' },
      { name: 'Adesivo Single Bond Universal', minimumStock: 2, unitOfMeasure: 'frasco', brand: '3M' },
      { name: 'Ácido Fosfórico 37%', minimumStock: 10, unitOfMeasure: 'seringa' },
    ],
    'Cimentos Odontológicos': [
      { name: 'Cimento Resinoso Dual', minimumStock: 2, unitOfMeasure: 'kit' },
      { name: 'Cimento Provisório', minimumStock: 3, unitOfMeasure: 'pote' },
    ],
    'Materiais de Endodontia': [
      { name: 'Lima K #15', minimumStock: 10, unitOfMeasure: 'unidade' },
      { name: 'Lima K #20', minimumStock: 10, unitOfMeasure: 'unidade' },
      { name: 'Hipoclorito de Sódio 2,5%', minimumStock: 5, unitOfMeasure: 'litro' },
      { name: 'Cone de Guta-percha Principal', minimumStock: 20, unitOfMeasure: 'unidade' },
    ],
    'Materiais de Moldagem': [
      { name: 'Alginato', minimumStock: 5, unitOfMeasure: 'kg' },
      { name: 'Silicone de Adição Pesado', minimumStock: 2, unitOfMeasure: 'kit' },
      { name: 'Gesso Pedra Tipo III', minimumStock: 5, unitOfMeasure: 'kg' },
    ],
    'Instrumentais Rotatórios': [
      { name: 'Broca Carbide Esférica FG', minimumStock: 10, unitOfMeasure: 'unidade' },
      { name: 'Ponta Diamantada 1012', minimumStock: 10, unitOfMeasure: 'unidade', brand: 'KG Sorensen' },
      { name: 'Disco de Lixa', minimumStock: 20, unitOfMeasure: 'unidade' },
    ],
    'EPI e Biossegurança': [
      { name: 'Óculos de Proteção', minimumStock: 5, unitOfMeasure: 'unidade' },
      { name: 'Gorro Descartável', minimumStock: 100, unitOfMeasure: 'unidade' },
      { name: 'Álcool 70%', minimumStock: 10, unitOfMeasure: 'litro' },
    ],
    'Material de Prótese': [
      { name: 'Resina Acrílica', minimumStock: 2, unitOfMeasure: 'kit' },
      { name: 'Dentes de Estoque', minimumStock: 10, unitOfMeasure: 'cartela' },
    ],
    'Cirurgia e Periodontia': [
      { name: 'Fio de Sutura Seda 3-0', minimumStock: 20, unitOfMeasure: 'unidade' },
      { name: 'Lâmina de Bisturi #15', minimumStock: 20, unitOfMeasure: 'unidade' },
    ],
    'Ortodontia': [
      { name: 'Bráquete Metálico', minimumStock: 50, unitOfMeasure: 'unidade' },
      { name: 'Fio Ortodôntico NiTi', minimumStock: 10, unitOfMeasure: 'unidade' },
      { name: 'Elástico Ligadura', minimumStock: 100, unitOfMeasure: 'unidade' },
    ],
    'Radiologia': [
      { name: 'Filme Radiográfico Periapical', minimumStock: 50, unitOfMeasure: 'unidade' },
      { name: 'Capa Plástica para Sensor', minimumStock: 100, unitOfMeasure: 'unidade' },
    ],
    'Profilaxia e Prevenção': [
      { name: 'Flúor Gel Acidulado', minimumStock: 5, unitOfMeasure: 'frasco' },
      { name: 'Pasta Profilática', minimumStock: 5, unitOfMeasure: 'pote' },
      { name: 'Escova Robinson', minimumStock: 20, unitOfMeasure: 'unidade' },
    ],
  };

  return { defaultCategories, defaultItemsByCategory };
}

export function getInventorySeedData(): {
  categories: Array<{
    name: string;
    description: string;
    color: string;
    items: Array<{ name: string; minimumStock: number; unitOfMeasure: string; brand?: string }>;
  }>;
} {
  const { defaultCategories, defaultItemsByCategory } = getDefaultInventoryData();

  return {
    categories: defaultCategories.map(cat => ({
      ...cat,
      items: defaultItemsByCategory[cat.name] || [],
    })),
  };
}

export async function seedInventoryDefaults(
  companyId: number,
  selection?: { categoryNames: string[]; itemsByCategory?: Record<string, string[]> }
): Promise<{ categories: any[]; items: any[] }> {
  try {
    const existingCategories = await getInventoryCategories(companyId);
    if (existingCategories.length > 0) {
      throw new Error('Esta empresa já possui categorias de estoque cadastradas');
    }

    const { defaultCategories, defaultItemsByCategory } = getDefaultInventoryData();

    let categoriesToCreate = defaultCategories;
    if (selection?.categoryNames && selection.categoryNames.length > 0) {
      categoriesToCreate = defaultCategories.filter(cat =>
        selection.categoryNames.includes(cat.name)
      );
    }

    const createdCategories: any[] = [];
    const createdItems: any[] = [];

    for (const categoryData of categoriesToCreate) {
      const [category] = await db
        .insert(inventoryCategories)
        .values({ ...categoryData, companyId })
        .returning();
      createdCategories.push(category);

      let itemsForCategory = defaultItemsByCategory[categoryData.name] || [];
      if (selection?.itemsByCategory && selection.itemsByCategory[categoryData.name]) {
        const selectedItemNames = selection.itemsByCategory[categoryData.name];
        itemsForCategory = itemsForCategory.filter(item => selectedItemNames.includes(item.name));
      }

      for (const itemData of itemsForCategory) {
        const [item] = await db
          .insert(inventoryItems)
          .values({ ...itemData, categoryId: category.id, companyId, currentStock: 0, price: 0, active: true })
          .returning();
        createdItems.push(item);
      }
    }

    return { categories: createdCategories, items: createdItems };
  } catch (error: any) {
    logger.error({ err: error }, 'Erro ao popular estoque:');
    throw error;
  }
}
