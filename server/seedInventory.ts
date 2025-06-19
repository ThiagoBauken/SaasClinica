import { db } from "./db";
import { inventoryCategories, inventoryItems } from "@shared/schema";

// Standard dental materials categories and items that can be reused by dentists
export async function seedInventoryData() {
  try {
    console.log('Iniciando população do banco com materiais odontológicos padrão...');

    // First, check if data already exists
    const existingCategories = await db.select().from(inventoryCategories);
    if (existingCategories.length > 0) {
      console.log('Dados de estoque já existem no banco.');
      return;
    }

    // Insert standard dental categories
    const categories = [
      {
        name: "Resinas e Compósitos",
        description: "Materiais restauradores fotopolimerizáveis",
        color: "#3498db"
      },
      {
        name: "Anestésicos",
        description: "Anestésicos locais e tópicos",
        color: "#e74c3c"
      },
      {
        name: "Materiais de Moldagem",
        description: "Alginatos, silicones e materiais de impressão",
        color: "#9b59b6"
      },
      {
        name: "Cimentos e Bases",
        description: "Cimentos definitivos e forradores",
        color: "#f39c12"
      },
      {
        name: "Materiais Endodônticos",
        description: "Limas, cones e medicamentos para endodontia",
        color: "#27ae60"
      },
      {
        name: "Materiais Preventivos",
        description: "Vernizes fluoretados e selantes",
        color: "#2ecc71"
      },
      {
        name: "Descartáveis e EPI",
        description: "Luvas, máscaras e materiais descartáveis",
        color: "#95a5a6"
      },
      {
        name: "Instrumentos Rotatórios",
        description: "Brocas, discos e pontas",
        color: "#34495e"
      }
    ];

    const insertedCategories = await db.insert(inventoryCategories).values(categories).returning();
    console.log(`${insertedCategories.length} categorias inseridas.`);

    // Get category IDs for reference
    const categoryMap = new Map();
    insertedCategories.forEach(cat => {
      categoryMap.set(cat.name, cat.id);
    });

    // Insert standard dental materials
    const standardItems = [
      // Resinas e Compósitos
      {
        name: "Resina Z350 XT A2",
        description: "Resina composta fotopolimerizável universal cor A2",
        categoryId: categoryMap.get("Resinas e Compósitos"),
        sku: "3M-Z350-A2",
        brand: "3M ESPE",
        supplier: "3M do Brasil",
        minimumStock: 5,
        currentStock: 12,
        price: 14500, // R$ 145,00
        unitOfMeasure: "seringa",
        location: "Armário 1, Prateleira 2"
      },
      {
        name: "Resina Filtek Universal A3",
        description: "Resina composta universal cor A3",
        categoryId: categoryMap.get("Resinas e Compósitos"),
        sku: "3M-FU-A3",
        brand: "3M ESPE",
        supplier: "3M do Brasil",
        minimumStock: 3,
        currentStock: 8,
        price: 16200, // R$ 162,00
        unitOfMeasure: "seringa",
        location: "Armário 1, Prateleira 2"
      },
      {
        name: "Resina Tetric N-Ceram A1",
        description: "Resina composta nanohíbrida cor A1",
        categoryId: categoryMap.get("Resinas e Compósitos"),
        sku: "IVO-TNC-A1",
        brand: "Ivoclar Vivadent",
        supplier: "Ivoclar Vivadent",
        minimumStock: 4,
        currentStock: 6,
        price: 13800, // R$ 138,00
        unitOfMeasure: "seringa",
        location: "Armário 1, Prateleira 2"
      },

      // Anestésicos
      {
        name: "Lidocaína 2% com Epinefrina",
        description: "Anestésico local com vasoconstritor 1:100.000",
        categoryId: categoryMap.get("Anestésicos"),
        sku: "DFL-LID2E",
        brand: "DFL",
        supplier: "DFL Indústria e Comércio",
        minimumStock: 10,
        currentStock: 25,
        price: 4200, // R$ 42,00
        unitOfMeasure: "caixa 50 tubetes",
        location: "Geladeira, Prateleira 1"
      },
      {
        name: "Mepivacaína 2% sem Vasoconstritor",
        description: "Anestésico local sem epinefrina",
        categoryId: categoryMap.get("Anestésicos"),
        sku: "DFL-MEP2",
        brand: "DFL",
        supplier: "DFL Indústria e Comércio",
        minimumStock: 5,
        currentStock: 12,
        price: 3850, // R$ 38,50
        unitOfMeasure: "caixa 50 tubetes",
        location: "Geladeira, Prateleira 1"
      },
      {
        name: "Gel Anestésico Tópico Benzocaína",
        description: "Anestésico tópico sabor tutti-frutti 20%",
        categoryId: categoryMap.get("Anestésicos"),
        sku: "DFL-BENZ20",
        brand: "DFL",
        supplier: "DFL Indústria e Comércio",
        minimumStock: 3,
        currentStock: 8,
        price: 1850, // R$ 18,50
        unitOfMeasure: "pote 12g",
        location: "Armário 2, Prateleira 1"
      },

      // Materiais de Moldagem
      {
        name: "Alginato Jeltrate Plus",
        description: "Alginato para moldagem de alta precisão",
        categoryId: categoryMap.get("Materiais de Moldagem"),
        sku: "DENTSPLY-JP",
        brand: "Dentsply Sirona",
        supplier: "Dentsply Sirona",
        minimumStock: 2,
        currentStock: 5,
        price: 8900, // R$ 89,00
        unitOfMeasure: "pacote 454g",
        location: "Armário 3, Prateleira 1"
      },
      {
        name: "Silicone de Condensação Optosil",
        description: "Silicone de moldagem massa base",
        categoryId: categoryMap.get("Materiais de Moldagem"),
        sku: "KULZER-OPT",
        brand: "Kulzer",
        supplier: "Kulzer do Brasil",
        minimumStock: 1,
        currentStock: 3,
        price: 12400, // R$ 124,00
        unitOfMeasure: "kit base + catalisador",
        location: "Armário 3, Prateleira 2"
      },

      // Cimentos e Bases
      {
        name: "Cimento de Ionômero de Vidro Vidrion R",
        description: "Cimento restaurador radiopaco",
        categoryId: categoryMap.get("Cimentos e Bases"),
        sku: "SSW-VDR",
        brand: "SS White",
        supplier: "SS White Duflex",
        minimumStock: 3,
        currentStock: 7,
        price: 5600, // R$ 56,00
        unitOfMeasure: "kit pó + líquido",
        location: "Armário 2, Prateleira 3"
      },
      {
        name: "Cimento Resinoso RelyX Ultimate",
        description: "Cimento resinoso dual para cimentação",
        categoryId: categoryMap.get("Cimentos e Bases"),
        sku: "3M-RXU",
        brand: "3M ESPE",
        supplier: "3M do Brasil",
        minimumStock: 2,
        currentStock: 4,
        price: 28500, // R$ 285,00
        unitOfMeasure: "kit completo",
        location: "Armário 2, Prateleira 3"
      },

      // Materiais Endodônticos
      {
        name: "Lima K-File #25 25mm",
        description: "Lima manual para preparo de canais radiculares",
        categoryId: categoryMap.get("Materiais Endodônticos"),
        sku: "DENTSPLY-KF25",
        brand: "Dentsply Sirona",
        supplier: "Dentsply Sirona",
        minimumStock: 20,
        currentStock: 35,
        price: 1200, // R$ 12,00
        unitOfMeasure: "unidade",
        location: "Gaveta Endo, Compartimento 1"
      },
      {
        name: "Cones de Guta-Percha #25",
        description: "Cones de guta-percha para obturação",
        categoryId: categoryMap.get("Materiais Endodônticos"),
        sku: "DENTSPLY-GP25",
        brand: "Dentsply Sirona",
        supplier: "Dentsply Sirona",
        minimumStock: 50,
        currentStock: 120,
        price: 450, // R$ 4,50
        unitOfMeasure: "unidade",
        location: "Gaveta Endo, Compartimento 2"
      },
      {
        name: "Cimento Endodôntico AH Plus",
        description: "Cimento epóxico para obturação de canais",
        categoryId: categoryMap.get("Materiais Endodônticos"),
        sku: "DENTSPLY-AHP",
        brand: "Dentsply Sirona",  
        supplier: "Dentsply Sirona",
        minimumStock: 1,
        currentStock: 2,
        price: 18500, // R$ 185,00
        unitOfMeasure: "kit pasta A + pasta B",
        location: "Gaveta Endo, Compartimento 3"
      },

      // Materiais Preventivos
      {
        name: "Verniz Fluoretado Duraphat",
        description: "Verniz com 5% de fluoreto de sódio",
        categoryId: categoryMap.get("Materiais Preventivos"),
        sku: "COLGATE-DUR",
        brand: "Colgate",
        supplier: "Colgate-Palmolive",
        minimumStock: 2,
        currentStock: 6,
        price: 12800, // R$ 128,00
        unitOfMeasure: "tubo 10ml",
        location: "Armário Preventivo"
      },
      {
        name: "Selante Fotopolimerizável FluroShield",
        description: "Selante de fóssulas e fissuras com flúor",
        categoryId: categoryMap.get("Materiais Preventivos"),
        sku: "DENTSPLY-FS",
        brand: "Dentsply Sirona",
        supplier: "Dentsply Sirona",
        minimumStock: 3,
        currentStock: 8,
        price: 9200, // R$ 92,00
        unitOfMeasure: "seringa 1,2ml",
        location: "Armário Preventivo"
      },

      // Descartáveis e EPI
      {
        name: "Luvas Nitrílicas Azuis M",
        description: "Luvas de procedimento sem pó tamanho M",
        categoryId: categoryMap.get("Descartáveis e EPI"),
        sku: "MEDIX-LNM",
        brand: "Medix",
        supplier: "Medix Medical",
        minimumStock: 5,
        currentStock: 15,
        price: 3200, // R$ 32,00
        unitOfMeasure: "caixa 100 unidades",
        location: "Estoque EPI"
      },
      {
        name: "Máscaras Cirúrgicas Tripla Camada",
        description: "Máscaras descartáveis com elástico",
        categoryId: categoryMap.get("Descartáveis e EPI"),
        sku: "MEDIX-MASK",
        brand: "Medix",
        supplier: "Medix Medical",
        minimumStock: 10,
        currentStock: 25,
        price: 1800, // R$ 18,00
        unitOfMeasure: "caixa 50 unidades",
        location: "Estoque EPI"
      },
      {
        name: "Babadores Impermeáveis",
        description: "Babadores descartáveis com barreira plástica",
        categoryId: categoryMap.get("Descartáveis e EPI"),
        sku: "MEDIX-BAB",
        brand: "Medix",
        supplier: "Medix Medical",
        minimumStock: 5,
        currentStock: 12,
        price: 2400, // R$ 24,00
        unitOfMeasure: "pacote 100 unidades",
        location: "Estoque EPI"
      },

      // Instrumentos Rotatórios
      {
        name: "Broca Carbide 330 FG",
        description: "Broca esférica para remoção de cárie",
        categoryId: categoryMap.get("Instrumentos Rotatórios"),
        sku: "KG-330FG",
        brand: "KG Sorensen",
        supplier: "KG Sorensen",
        minimumStock: 10,
        currentStock: 18,
        price: 850, // R$ 8,50
        unitOfMeasure: "unidade",
        location: "Organizador Brocas, Gaveta 1"
      },
      {
        name: "Broca Diamantada 1014 HL",
        description: "Broca diamantada para preparo cavitário",
        categoryId: categoryMap.get("Instrumentos Rotatórios"),
        sku: "KG-1014HL",
        brand: "KG Sorensen",
        supplier: "KG Sorensen",
        minimumStock: 8,
        currentStock: 14,
        price: 1250, // R$ 12,50
        unitOfMeasure: "unidade",
        location: "Organizador Brocas, Gaveta 2"
      },
      {
        name: "Disco de Lixa Sof-Lex Médio",
        description: "Disco abrasivo para acabamento e polimento",
        categoryId: categoryMap.get("Instrumentos Rotatórios"),
        sku: "3M-SOFLEX-M",
        brand: "3M ESPE",
        supplier: "3M do Brasil",
        minimumStock: 2,
        currentStock: 6,
        price: 4800, // R$ 48,00
        unitOfMeasure: "kit 50 discos",
        location: "Organizador Brocas, Gaveta 3"
      }
    ];

    const insertedItems = await db.insert(inventoryItems).values(standardItems).returning();
    console.log(`${insertedItems.length} itens de estoque inseridos.`);
    
    console.log('População do banco concluída com sucesso!');
    console.log('Materiais odontológicos padrão disponíveis para todos os dentistas.');

  } catch (error) {
    console.error('Erro ao popular banco com dados de estoque:', error);
    throw error;
  }
}