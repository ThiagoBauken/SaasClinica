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
  const socialLinks = data.social || {};
  const gallery = data.gallery || [];
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.seo.title || data.clinicName}</title>
      <meta name="description" content="${data.seo.description}">
      <meta name="keywords" content="${data.seo.keywords}">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; line-height: 1.6; overflow-x: hidden; }
        
        /* Header */
        .header { position: fixed; top: 0; width: 100%; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 1rem 2rem; z-index: 1000; }
        .nav { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; }
        .logo { font-size: 1.5rem; font-weight: 700; color: ${data.colors.primary}; }
        .nav-links { display: flex; gap: 2rem; list-style: none; }
        .nav-links a { text-decoration: none; color: #333; font-weight: 500; }
        
        /* Hero Section */
        .hero { 
          background: linear-gradient(135deg, ${data.colors.primary}, ${data.colors.accent}); 
          color: white; padding: 120px 20px 80px; text-align: center; position: relative;
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .hero-content { max-width: 800px; }
        .hero h1 { font-size: 3.5rem; margin-bottom: 1.5rem; font-weight: 700; }
        .hero p { font-size: 1.3rem; opacity: 0.9; margin-bottom: 2rem; }
        .cta-button { 
          background: ${data.colors.accent}; color: white; padding: 1rem 2rem; 
          border: none; border-radius: 50px; font-size: 1.1rem; font-weight: 600;
          cursor: pointer; transition: transform 0.3s ease;
        }
        .cta-button:hover { transform: translateY(-2px); }
        
        /* About Section */
        .about { padding: 100px 20px; background: ${data.colors.secondary}; }
        .about-content { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
        .about h2 { font-size: 2.5rem; margin-bottom: 1.5rem; color: ${data.colors.primary}; }
        .about p { font-size: 1.1rem; color: #666; }
        
        /* Services Section */
        .services { padding: 100px 20px; }
        .services h2 { text-align: center; font-size: 2.5rem; margin-bottom: 3rem; color: ${data.colors.primary}; }
        .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1200px; margin: 0 auto; }
        .service-card { 
          background: white; padding: 2.5rem; border-radius: 20px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center;
          transition: transform 0.3s ease;
        }
        .service-card:hover { transform: translateY(-10px); }
        .service-card h3 { font-size: 1.3rem; margin-bottom: 1rem; color: ${data.colors.primary}; }
        .service-card p { color: #666; margin-bottom: 1rem; }
        .service-price { font-size: 1.2rem; font-weight: 600; color: ${data.colors.accent}; }
        
        /* Gallery Section */
        .gallery { padding: 100px 20px; background: ${data.colors.secondary}; }
        .gallery h2 { text-align: center; font-size: 2.5rem; margin-bottom: 3rem; color: ${data.colors.primary}; }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; max-width: 1200px; margin: 0 auto; }
        .gallery-item { border-radius: 15px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .gallery-item img { width: 100%; height: 200px; object-fit: cover; }
        
        /* Contact Section */
        .contact { padding: 100px 20px; background: ${data.colors.primary}; color: white; }
        .contact-content { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
        .contact h2 { font-size: 2.5rem; margin-bottom: 2rem; }
        .contact-info { display: flex; flex-direction: column; gap: 1rem; }
        .contact-item { display: flex; align-items: center; gap: 1rem; }
        .contact-item span { font-size: 1.5rem; }
        
        /* Social Media */
        .social-links { display: flex; gap: 1rem; margin-top: 2rem; }
        .social-link { 
          width: 50px; height: 50px; border-radius: 50%; 
          display: flex; align-items: center; justify-content: center;
          text-decoration: none; color: white; font-size: 1.5rem;
          transition: transform 0.3s ease;
        }
        .social-link:hover { transform: scale(1.1); }
        .social-instagram { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); }
        .social-facebook { background: #4267B2; }
        .social-linkedin { background: #0077B5; }
        .social-youtube { background: #FF0000; }
        
        /* WhatsApp Button */
        .whatsapp-btn { 
          position: fixed; bottom: 30px; right: 30px; background: #25D366; 
          color: white; border: none; border-radius: 50%; width: 70px; height: 70px; 
          font-size: 28px; cursor: pointer; box-shadow: 0 8px 25px rgba(37,211,102,0.4);
          z-index: 1000; transition: transform 0.3s ease;
        }
        .whatsapp-btn:hover { transform: scale(1.1); }
        
        /* Footer */
        .footer { background: #333; color: white; padding: 2rem; text-align: center; }
        
        /* Responsive */
        @media (max-width: 768px) {
          .hero h1 { font-size: 2.5rem; }
          .about-content, .contact-content { grid-template-columns: 1fr; }
          .nav-links { display: none; }
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <header class="header">
        <nav class="nav">
          <div class="logo">${data.clinicName}</div>
          <ul class="nav-links">
            <li><a href="#home">Início</a></li>
            <li><a href="#about">Sobre</a></li>
            <li><a href="#services">Serviços</a></li>
            <li><a href="#gallery">Galeria</a></li>
            <li><a href="#contact">Contato</a></li>
          </ul>
        </nav>
      </header>
      
      <!-- Hero Section -->
      <section id="home" class="hero">
        <div class="hero-content">
          <h1>${data.content.hero.title}</h1>
          <p>${data.content.hero.subtitle}</p>
          <button class="cta-button" onclick="document.getElementById('contact').scrollIntoView({behavior: 'smooth'})">
            Agendar Consulta
          </button>
        </div>
      </section>
      
      <!-- About Section -->
      <section id="about" class="about">
        <div class="about-content">
          <div>
            <h2>${data.content.about.title}</h2>
            <p>${data.content.about.description}</p>
          </div>
          <div>
            <img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=500&h=400&fit=crop" alt="Clínica" style="width: 100%; border-radius: 15px;">
          </div>
        </div>
      </section>
      
      <!-- Services Section -->
      <section id="services" class="services">
        <h2>Nossos Serviços</h2>
        <div class="service-grid">
          ${data.content.services.map(service => `
            <div class="service-card">
              <h3>${service.name}</h3>
              <p>${service.description}</p>
              ${service.price ? `<div class="service-price">${service.price}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </section>
      
      ${gallery.length > 0 ? `
      <!-- Gallery Section -->
      <section id="gallery" class="gallery">
        <h2>Nossa Galeria</h2>
        <div class="gallery-grid">
          ${gallery.map(photo => photo.url ? `
            <div class="gallery-item">
              <img src="${photo.url}" alt="${photo.alt}">
            </div>
          ` : '').join('')}
        </div>
      </section>
      ` : ''}
      
      <!-- Contact Section -->
      <section id="contact" class="contact">
        <div class="contact-content">
          <div>
            <h2>Entre em Contato</h2>
            <div class="contact-info">
              <div class="contact-item">
                <span>📞</span>
                <div>
                  <strong>Telefone</strong><br>
                  ${data.content.contact.phone}
                </div>
              </div>
              <div class="contact-item">
                <span>📧</span>
                <div>
                  <strong>Email</strong><br>
                  ${data.content.contact.email}
                </div>
              </div>
              <div class="contact-item">
                <span>📍</span>
                <div>
                  <strong>Endereço</strong><br>
                  ${data.content.contact.address}
                </div>
              </div>
              <div class="contact-item">
                <span>🕒</span>
                <div>
                  <strong>Horários</strong><br>
                  ${data.content.contact.hours}
                </div>
              </div>
            </div>
            
            <!-- Social Media Links -->
            <div class="social-links">
              ${socialLinks.instagram ? `<a href="${socialLinks.instagram}" class="social-link social-instagram" target="_blank">📷</a>` : ''}
              ${socialLinks.facebook ? `<a href="${socialLinks.facebook}" class="social-link social-facebook" target="_blank">📘</a>` : ''}
              ${socialLinks.linkedin ? `<a href="${socialLinks.linkedin}" class="social-link social-linkedin" target="_blank">💼</a>` : ''}
              ${socialLinks.youtube ? `<a href="${socialLinks.youtube}" class="social-link social-youtube" target="_blank">📺</a>` : ''}
            </div>
          </div>
          <div>
            <img src="https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=500&h=400&fit=crop" alt="Consultório" style="width: 100%; border-radius: 15px;">
          </div>
        </div>
      </section>
      
      <!-- Footer -->
      <footer class="footer">
        <p>&copy; 2024 ${data.clinicName}. Todos os direitos reservados.</p>
      </footer>
      
      <!-- WhatsApp Button -->
      ${data.content.contact.whatsapp ? `
        <button class="whatsapp-btn" onclick="window.open('https://wa.me/55${data.content.contact.whatsapp.replace(/\D/g, '')}?text=Olá, gostaria de agendar uma consulta!', '_blank')" title="Fale conosco no WhatsApp">
          💬
        </button>
      ` : ''}
      
      <script>
        // Smooth scroll for navigation
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
          anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
              behavior: 'smooth'
            });
          });
        });
        
        // Header scroll effect
        window.addEventListener('scroll', () => {
          const header = document.querySelector('.header');
          if (window.scrollY > 100) {
            header.style.background = 'rgba(255,255,255,0.98)';
          } else {
            header.style.background = 'rgba(255,255,255,0.95)';
          }
        });
      </script>
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

// Função para gerar preview do template com dados atuais
export async function getWebsitePreview(req: Request, res: Response) {
  try {
    const companyId = req.user?.companyId;
    const template = req.params.template as 'modern' | 'classic' | 'minimal';
    
    if (!['modern', 'classic', 'minimal'].includes(template)) {
      return res.status(400).json({ error: 'Template inválido' });
    }

    // Buscar dados salvos ou usar dados padrão da empresa
    let websiteData = websiteStorage.get(companyId || 0);
    
    if (!websiteData && companyId) {
      // Buscar dados da empresa no banco para popular automaticamente
      const company = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      const companyInfo = company[0];
      
      websiteData = {
        id: companyId,
        clinicName: companyInfo?.name || 'Clínica Odontológica',
        template,
        colors: {
          primary: '#0066cc',
          secondary: '#f8f9fa', 
          accent: '#28a745'
        },
        content: {
          hero: {
            title: companyInfo?.name || 'Clínica Odontológica',
            subtitle: 'Cuidando do seu sorriso com excelência e tecnologia de ponta'
          },
          about: {
            title: 'Sobre Nossa Clínica',
            description: 'Oferecemos tratamentos odontológicos de qualidade com uma equipe especializada e equipamentos modernos, priorizando o conforto e bem-estar dos nossos pacientes.'
          },
          services: [
            { name: 'Limpeza e Profilaxia', description: 'Limpeza profissional completa', price: 'A partir de R$ 80,00' },
            { name: 'Clareamento Dental', description: 'Clareamento a laser ou moldeira', price: 'A partir de R$ 350,00' },
            { name: 'Implantes Dentários', description: 'Implantes com tecnologia avançada', price: 'A partir de R$ 2.500,00' },
            { name: 'Ortodontia', description: 'Aparelhos fixos e alinhadores', price: 'A partir de R$ 180,00/mês' }
          ],
          contact: {
            phone: '(11) 9999-9999',
            whatsapp: '11999999999',
            email: companyInfo?.email || 'contato@clinica.com',
            address: 'Rua das Flores, 123 - Centro, São Paulo - SP',
            hours: 'Segunda a Sexta: 8:00 - 18:00 | Sábado: 8:00 - 12:00'
          },
          gallery: []
        },
        seo: {
          title: `${companyInfo?.name || 'Clínica Odontológica'} - Dentista Especializado`,
          description: 'Clínica odontológica com atendimento de qualidade, equipamentos modernos e profissionais especializados.',
          keywords: 'dentista, odontologia, clínica dental, implante, clareamento, ortodontia'
        },
        published: false,
        companyId: companyId || 0
      };
    }

    if (!websiteData) {
      return res.status(404).json({ error: 'Dados não encontrados' });
    }

    // Forçar o template solicitado para o preview
    websiteData.template = template;

    // Gerar HTML do template
    const templates = {
      modern: generateModernTemplate,
      classic: generateClassicTemplate,
      minimal: generateMinimalTemplate
    };

    const html = templates[template](websiteData);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Erro ao gerar preview:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}