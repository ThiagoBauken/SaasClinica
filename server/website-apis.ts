import { Request, Response } from 'express';
import { db } from './db';
import { companies } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface WebsiteData {
  id?: number;
  clinicName: string;
  domain?: string;
  customDomain?: string;
  template: 'modern' | 'classic' | 'minimal';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  content: {
    hero: {
      title: string;
      subtitle: string;
      image?: string;
    };
    about: {
      title: string;
      description: string;
      image?: string;
    };
    services: Array<{
      name: string;
      description: string;
      price?: string;
    }>;
    contact: {
      phone: string;
      whatsapp: string;
      email: string;
      address: string;
      hours: string;
    };
    gallery: string[];
  };
  seo: {
    title: string;
    description: string;
    keywords: string;
  };
  published: boolean;
  companyId: number;
  createdAt?: string;
  updatedAt?: string;
}

// Armazenamento temporário em memória (em produção seria no banco)
const websiteStorage = new Map<number, WebsiteData>();

// Gerar slug do domínio
function generateDomainSlug(clinicName: string): string {
  return clinicName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

// Obter dados do site da empresa
export async function getWebsite(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const website = websiteStorage.get(companyId);
    if (!website) {
      return res.status(404).json({ message: 'Site não encontrado' });
    }

    res.json(website);
  } catch (error) {
    console.error('Erro ao buscar site:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Criar ou atualizar site
export async function saveWebsite(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const websiteData: WebsiteData = {
      ...req.body,
      companyId,
      updatedAt: new Date().toISOString()
    };

    // Se não existe, criar novo
    if (!websiteData.id) {
      websiteData.id = companyId; // Usar companyId como ID único
      websiteData.createdAt = new Date().toISOString();
    }

    // Gerar domínio se não existir
    if (!websiteData.domain && websiteData.clinicName) {
      const slug = generateDomainSlug(websiteData.clinicName);
      websiteData.domain = `${slug}.dentcare.com.br`;
    }

    websiteStorage.set(companyId, websiteData);

    res.json({
      success: true,
      data: websiteData,
      message: 'Site salvo com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar site:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Falha ao salvar site'
    });
  }
}

// Publicar site
export async function publishWebsite(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const websiteData: WebsiteData = req.body;
    
    if (!websiteData.clinicName) {
      return res.status(400).json({ 
        error: 'Nome da clínica é obrigatório',
        message: 'Preencha o nome da clínica antes de publicar'
      });
    }

    // Gerar domínio
    const slug = generateDomainSlug(websiteData.clinicName);
    const domain = `${slug}.dentcare.com.br`;

    // Marcar como publicado
    const publishedWebsite: WebsiteData = {
      ...websiteData,
      id: companyId,
      companyId,
      domain,
      published: true,
      updatedAt: new Date().toISOString()
    };

    if (!publishedWebsite.createdAt) {
      publishedWebsite.createdAt = new Date().toISOString();
    }

    websiteStorage.set(companyId, publishedWebsite);

    // Simular criação do site estático
    await generateStaticWebsite(publishedWebsite);

    res.json({
      success: true,
      domain,
      message: 'Site publicado com sucesso',
      url: `https://${domain}`
    });
  } catch (error) {
    console.error('Erro ao publicar site:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Falha ao publicar site'
    });
  }
}

// Obter site público por domínio
export async function getPublicWebsite(req: Request, res: Response) {
  try {
    const { domain } = req.params;
    
    // Procurar site pelo domínio
    let foundWebsite: WebsiteData | null = null;
    for (const website of websiteStorage.values()) {
      if (website.domain === domain && website.published) {
        foundWebsite = website;
        break;
      }
    }

    if (!foundWebsite) {
      return res.status(404).json({ message: 'Site não encontrado' });
    }

    // Remover dados sensíveis para visualização pública
    const publicData = {
      clinicName: foundWebsite.clinicName,
      template: foundWebsite.template,
      colors: foundWebsite.colors,
      content: foundWebsite.content,
      seo: foundWebsite.seo
    };

    res.json(publicData);
  } catch (error) {
    console.error('Erro ao buscar site público:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Listar todos os sites publicados (para administração)
export async function listPublishedWebsites(req: Request, res: Response) {
  try {
    const publishedSites = Array.from(websiteStorage.values())
      .filter(site => site.published)
      .map(site => ({
        id: site.id,
        clinicName: site.clinicName,
        domain: site.domain,
        template: site.template,
        published: site.published,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt
      }));

    res.json(publishedSites);
  } catch (error) {
    console.error('Erro ao listar sites:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

// Despublicar site
export async function unpublishWebsite(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    const website = websiteStorage.get(companyId);
    if (!website) {
      return res.status(404).json({ message: 'Site não encontrado' });
    }

    website.published = false;
    website.updatedAt = new Date().toISOString();
    websiteStorage.set(companyId, website);

    res.json({
      success: true,
      message: 'Site despublicado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao despublicar site:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Falha ao despublicar site'
    });
  }
}

// Função auxiliar para gerar site estático (simular)
async function generateStaticWebsite(websiteData: WebsiteData): Promise<void> {
  // Em produção, isso geraria arquivos HTML/CSS/JS estáticos
  console.log(`Gerando site estático para: ${websiteData.domain}`);
  
  // Simular templates diferentes
  const templates = {
    modern: generateModernTemplate(websiteData),
    classic: generateClassicTemplate(websiteData),
    minimal: generateMinimalTemplate(websiteData)
  };
  
  const template = templates[websiteData.template];
  console.log(`Template ${websiteData.template} gerado com sucesso`);
  
  // Aqui salvaria os arquivos no sistema de arquivos ou CDN
  return Promise.resolve();
}

function generateModernTemplate(data: WebsiteData): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.seo.title || data.clinicName}</title>
      <meta name="description" content="${data.seo.description}">
      <meta name="keywords" content="${data.seo.keywords}">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; line-height: 1.6; }
        .hero { background: linear-gradient(135deg, ${data.colors.primary}, ${data.colors.secondary}); color: white; padding: 100px 20px; text-align: center; }
        .hero h1 { font-size: 3rem; margin-bottom: 1rem; }
        .hero p { font-size: 1.2rem; opacity: 0.9; }
        .services { padding: 80px 20px; }
        .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1200px; margin: 0 auto; }
        .service-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .whatsapp-btn { position: fixed; bottom: 20px; right: 20px; background: #25D366; color: white; border: none; border-radius: 50%; width: 60px; height: 60px; font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      </style>
    </head>
    <body>
      <div class="hero">
        <h1>${data.content.hero.title}</h1>
        <p>${data.content.hero.subtitle}</p>
      </div>
      
      <div class="services">
        <div class="service-grid">
          ${data.content.services.map(service => `
            <div class="service-card">
              <h3>${service.name}</h3>
              <p>${service.description}</p>
              ${service.price ? `<div style="color: ${data.colors.primary}; font-weight: bold; margin-top: 1rem;">${service.price}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      ${data.content.contact.whatsapp ? `
        <button class="whatsapp-btn" onclick="window.open('https://wa.me/55${data.content.contact.whatsapp.replace(/\D/g, '')}?text=Olá, gostaria de agendar uma consulta!', '_blank')">
          💬
        </button>
      ` : ''}
    </body>
    </html>
  `;
}

function generateClassicTemplate(data: WebsiteData): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.seo.title || data.clinicName}</title>
      <meta name="description" content="${data.seo.description}">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; }
        .header { background: ${data.colors.primary}; color: white; padding: 60px 20px; text-align: center; }
        .content { max-width: 1000px; margin: 0 auto; padding: 60px 20px; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin: 40px 0; }
        .service { border: 2px solid ${data.colors.primary}; padding: 1.5rem; border-radius: 8px; }
        .whatsapp-btn { position: fixed; bottom: 20px; right: 20px; background: #25D366; color: white; padding: 15px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.content.hero.title}</h1>
        <p>${data.content.hero.subtitle}</p>
      </div>
      
      <div class="content">
        <section>
          <h2>${data.content.about.title}</h2>
          <p>${data.content.about.description}</p>
        </section>
        
        <div class="services">
          ${data.content.services.map(service => `
            <div class="service">
              <h3>${service.name}</h3>
              <p>${service.description}</p>
              ${service.price ? `<strong style="color: ${data.colors.primary};">${service.price}</strong>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      
      ${data.content.contact.whatsapp ? `
        <a href="https://wa.me/55${data.content.contact.whatsapp.replace(/\D/g, '')}?text=Olá, gostaria de agendar uma consulta!" class="whatsapp-btn" target="_blank">
          📱 WhatsApp
        </a>
      ` : ''}
    </body>
    </html>
  `;
}

function generateMinimalTemplate(data: WebsiteData): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.seo.title || data.clinicName}</title>
      <meta name="description" content="${data.seo.description}">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica', sans-serif; line-height: 1.8; color: #2c3e50; background: #fafafa; }
        .container { max-width: 800px; margin: 0 auto; padding: 80px 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; color: ${data.colors.primary}; }
        h2 { font-size: 1.8rem; margin: 3rem 0 1rem; color: ${data.colors.secondary}; }
        .service { margin: 2rem 0; padding: 1rem 0; border-bottom: 1px solid #eee; }
        .service:last-child { border-bottom: none; }
        .whatsapp-btn { position: fixed; bottom: 30px; right: 30px; background: #25D366; color: white; border: none; padding: 12px; border-radius: 50%; width: 50px; height: 50px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${data.content.hero.title}</h1>
        <p style="font-size: 1.1rem; margin-bottom: 3rem;">${data.content.hero.subtitle}</p>
        
        <h2>${data.content.about.title}</h2>
        <p>${data.content.about.description}</p>
        
        <h2>Serviços</h2>
        ${data.content.services.map(service => `
          <div class="service">
            <h3>${service.name}</h3>
            <p>${service.description}</p>
            ${service.price ? `<p style="color: ${data.colors.primary}; font-weight: 600;">${service.price}</p>` : ''}
          </div>
        `).join('')}
        
        <h2>Contato</h2>
        <p>📍 ${data.content.contact.address}</p>
        <p>📞 ${data.content.contact.phone}</p>
        <p>📧 ${data.content.contact.email}</p>
        <p>🕒 ${data.content.contact.hours}</p>
      </div>
      
      ${data.content.contact.whatsapp ? `
        <button class="whatsapp-btn" onclick="window.open('https://wa.me/55${data.content.contact.whatsapp.replace(/\D/g, '')}?text=Olá, gostaria de agendar uma consulta!', '_blank')">
          💬
        </button>
      ` : ''}
    </body>
    </html>
  `;
}