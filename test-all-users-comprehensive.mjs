import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';

// Credenciais dos usuários
const USERS = {
  admin: { username: 'admin', password: 'admin123', role: 'Admin' },
  dentista: { username: 'dra.ana', password: 'dentista123', role: 'Dentista' },
  recepcionista: { username: 'maria', password: 'recep123', role: 'Recepcionista' }
};

// Páginas a testar
const PAGES = [
  { name: 'Dashboard', urls: ['/dashboard', '/'] },
  { name: 'Pacientes', urls: ['/patients', '/pacientes'] },
  { name: 'Agenda', urls: ['/agenda', '/schedule'] },
  { name: 'Estoque', urls: ['/inventory', '/estoque'] },
  { name: 'Financeiro', urls: ['/financial', '/financeiro'] },
  { name: 'Configurações', urls: ['/configuracoes', '/settings'] }
];

// Criar pasta para screenshots
const screenshotsDir = 'c:\\Users\\Thiago\\Desktop\\site clinca dentista\\test-screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Relatório de testes
const testReport = {
  timestamp: new Date().toISOString(),
  users: {}
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureConsoleErrors(page, userRole, pageName) {
  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  page.on('requestfailed', request => {
    errors.push(`Request Failed: ${request.url()} - ${request.failure().errorText}`);
  });

  return { errors, warnings };
}

async function takeScreenshot(page, userRole, pageName, suffix = '') {
  const filename = `${userRole}_${pageName}${suffix}.png`.replace(/[\/\s]/g, '_');
  const filepath = path.join(screenshotsDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function testLogin(browser, userCredentials, userRole) {
  console.log(`\n========================================`);
  console.log(`Testando usuário: ${userRole} (${userCredentials.username})`);
  console.log(`========================================\n`);

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const userReport = {
    role: userRole,
    username: userCredentials.username,
    loginSuccess: false,
    pages: {},
    consoleErrors: [],
    screenshots: []
  };

  // Capturar erros
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`[Page Error] ${error.message}`);
  });

  page.on('requestfailed', request => {
    consoleErrors.push(`[Request Failed] ${request.url()}`);
  });

  try {
    // 1. TESTE DE LOGIN
    console.log(`[${userRole}] 1. Testando Login...`);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(1000);

    // Screenshot da página de login
    const loginScreenshot = await takeScreenshot(page, userRole, 'Login', '_inicial');
    userReport.screenshots.push(loginScreenshot);

    // Preencher formulário de login
    await page.fill('input[name="username"], input[type="text"]', userCredentials.username);
    await page.fill('input[name="password"], input[type="password"]', userCredentials.password);
    await sleep(500);

    // Screenshot com credenciais preenchidas
    await takeScreenshot(page, userRole, 'Login', '_preenchido');

    // Clicar no botão de login
    await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');
    console.log(`[${userRole}] Aguardando redirecionamento após login...`);

    // Aguardar navegação ou erro
    await Promise.race([
      page.waitForNavigation({ timeout: 10000 }),
      sleep(10000)
    ]);

    await sleep(2000);

    const currentUrl = page.url();
    console.log(`[${userRole}] URL atual após login: ${currentUrl}`);

    // Verificar se login foi bem-sucedido
    if (currentUrl.includes('/auth')) {
      userReport.loginSuccess = false;
      userReport.loginError = 'Permaneceu na página de login';
      console.log(`[${userRole}] ❌ Login falhou - permaneceu em /auth`);
      await takeScreenshot(page, userRole, 'Login', '_FALHOU');
    } else {
      userReport.loginSuccess = true;
      userReport.redirectedTo = currentUrl;
      console.log(`[${userRole}] ✅ Login bem-sucedido - redirecionado para ${currentUrl}`);
      await takeScreenshot(page, userRole, 'Login', '_SUCESSO');

      // 2. TESTAR CADA PÁGINA
      for (const pageConfig of PAGES) {
        await testPage(page, userRole, pageConfig, userReport);
      }
    }

  } catch (error) {
    console.log(`[${userRole}] ❌ Erro durante teste de login: ${error.message}`);
    userReport.loginError = error.message;
    await takeScreenshot(page, userRole, 'Login', '_ERRO');
  }

  userReport.consoleErrors = [...new Set(consoleErrors)];
  await context.close();

  return userReport;
}

async function testPage(page, userRole, pageConfig, userReport) {
  const pageName = pageConfig.name;
  console.log(`\n[${userRole}] Testando página: ${pageName}`);

  const pageReport = {
    name: pageName,
    accessible: false,
    loaded: false,
    hasContent: false,
    errors: [],
    warnings: [],
    screenshots: [],
    elements: {}
  };

  let testedUrl = null;

  // Tentar cada URL possível
  for (const url of pageConfig.urls) {
    try {
      console.log(`[${userRole}] - Acessando ${url}...`);

      const errors = [];
      const warnings = [];

      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
        if (msg.type() === 'warning') warnings.push(msg.text());
      });

      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await sleep(2000);

      const currentUrl = page.url();

      // Verificar se foi redirecionado para /auth (sem permissão)
      if (currentUrl.includes('/auth')) {
        console.log(`[${userRole}] - ⛔ Sem permissão - redirecionado para /auth`);
        pageReport.accessible = false;
        pageReport.noPermission = true;
        await takeScreenshot(page, userRole, pageName, '_SEM_PERMISSAO');
        continue;
      }

      // Verificar se foi redirecionado para outra página
      if (!currentUrl.includes(url) && !currentUrl.endsWith('/') && pageName !== 'Dashboard') {
        console.log(`[${userRole}] - ⚠️ Redirecionado de ${url} para ${currentUrl}`);
        pageReport.redirectedTo = currentUrl;
      }

      pageReport.accessible = true;
      pageReport.loaded = true;
      testedUrl = url;

      // Screenshot da página
      const screenshot = await takeScreenshot(page, userRole, pageName);
      pageReport.screenshots.push(screenshot);

      // Verificar se tem conteúdo
      const bodyText = await page.textContent('body');
      pageReport.hasContent = bodyText.length > 100;

      // Análise específica por tipo de página
      await analyzePage(page, pageName, pageReport);

      pageReport.errors = [...new Set(errors)];
      pageReport.warnings = [...new Set(warnings)];

      console.log(`[${userRole}] - ✅ ${pageName} carregou com sucesso`);
      console.log(`[${userRole}]   - Tem conteúdo: ${pageReport.hasContent ? 'SIM' : 'NÃO'}`);
      console.log(`[${userRole}]   - Erros: ${pageReport.errors.length}`);

      break; // Se carregou com sucesso, não precisa testar outras URLs

    } catch (error) {
      console.log(`[${userRole}] - ❌ Erro ao acessar ${url}: ${error.message}`);
      pageReport.errors.push(error.message);

      if (url === pageConfig.urls[pageConfig.urls.length - 1]) {
        // Última URL e deu erro
        pageReport.accessible = false;
        pageReport.loaded = false;
        await takeScreenshot(page, userRole, pageName, '_ERRO');
      }
    }
  }

  userReport.pages[pageName] = pageReport;
}

async function analyzePage(page, pageName, pageReport) {
  try {
    switch (pageName) {
      case 'Dashboard':
        // Procurar cards/métricas
        pageReport.elements.cards = await page.locator('.card, [class*="card"], [class*="metric"]').count();
        pageReport.elements.hasCharts = await page.locator('canvas, svg[class*="chart"]').count() > 0;
        console.log(`    - Cards encontrados: ${pageReport.elements.cards}`);
        break;

      case 'Pacientes':
        // Procurar lista de pacientes e botão de cadastro
        pageReport.elements.hasList = await page.locator('table, .patient-list, [class*="list"]').count() > 0;
        pageReport.elements.hasAddButton = await page.locator('button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Cadastrar")').count() > 0;

        // Tentar abrir modal de cadastro
        if (pageReport.elements.hasAddButton) {
          try {
            await page.click('button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Cadastrar")', { timeout: 3000 });
            await sleep(1000);
            pageReport.elements.modalOpened = await page.locator('.modal, [role="dialog"], [class*="modal"]').count() > 0;
            console.log(`    - Modal de cadastro abre: ${pageReport.elements.modalOpened ? 'SIM' : 'NÃO'}`);

            // Fechar modal
            await page.keyboard.press('Escape');
            await sleep(500);
          } catch (e) {
            pageReport.elements.modalOpened = false;
          }
        }
        break;

      case 'Agenda':
        // Procurar calendário e agendamentos
        pageReport.elements.hasCalendar = await page.locator('.calendar, [class*="calendar"], .fc, .rbc-calendar').count() > 0;
        pageReport.elements.hasAppointments = await page.locator('.appointment, .event, [class*="appointment"], [class*="event"]').count();
        pageReport.elements.hasNewButton = await page.locator('button:has-text("Novo"), button:has-text("Agendar")').count() > 0;
        console.log(`    - Tem calendário: ${pageReport.elements.hasCalendar ? 'SIM' : 'NÃO'}`);
        console.log(`    - Agendamentos visíveis: ${pageReport.elements.hasAppointments}`);
        break;

      case 'Estoque':
        // Procurar lista de itens
        pageReport.elements.hasItems = await page.locator('table tr, .item, [class*="item"]').count();
        pageReport.elements.isEmpty = pageReport.elements.hasItems === 0;
        console.log(`    - Itens encontrados: ${pageReport.elements.hasItems}`);
        break;

      case 'Financeiro':
        // Procurar dados financeiros
        pageReport.elements.hasTransactions = await page.locator('table tr, .transaction, [class*="transaction"]').count();
        pageReport.elements.hasCharts = await page.locator('canvas, svg[class*="chart"]').count() > 0;
        console.log(`    - Transações: ${pageReport.elements.hasTransactions}`);
        break;

      case 'Configurações':
        // Procurar seções de configuração
        pageReport.elements.hasSections = await page.locator('section, .settings-section, [class*="section"]').count();
        pageReport.elements.hasTabs = await page.locator('[role="tab"], .tab, [class*="tab"]').count();
        console.log(`    - Seções: ${pageReport.elements.hasSections}`);
        break;
    }
  } catch (error) {
    console.log(`    - Erro na análise: ${error.message}`);
  }
}

async function generateReport(allReports) {
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           RELATÓRIO COMPLETO DE TESTES - TODOS USUÁRIOS        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const reportLines = [];
  reportLines.push('# RELATÓRIO DE TESTES - SISTEMA CLÍNICA ODONTOLÓGICA\n');
  reportLines.push(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);
  reportLines.push(`URL Base: ${BASE_URL}\n`);
  reportLines.push('═'.repeat(80) + '\n\n');

  // Resumo geral
  reportLines.push('## RESUMO GERAL\n');
  for (const [userKey, report] of Object.entries(allReports)) {
    const loginStatus = report.loginSuccess ? '✅ SUCESSO' : '❌ FALHOU';
    reportLines.push(`### ${report.role} (${report.username})`);
    reportLines.push(`- Login: ${loginStatus}`);
    if (report.loginSuccess) {
      const accessiblePages = Object.values(report.pages).filter(p => p.accessible).length;
      reportLines.push(`- Páginas acessíveis: ${accessiblePages}/${PAGES.length}`);
    }
    reportLines.push('');
  }
  reportLines.push('\n' + '═'.repeat(80) + '\n\n');

  // Detalhes por usuário
  for (const [userKey, report] of Object.entries(allReports)) {
    reportLines.push(`## USUÁRIO: ${report.role.toUpperCase()}\n`);
    reportLines.push(`**Username:** ${report.username}`);
    reportLines.push(`**Login:** ${report.loginSuccess ? '✅ Bem-sucedido' : '❌ Falhou'}\n`);

    if (report.loginError) {
      reportLines.push(`**Erro de Login:** ${report.loginError}\n`);
    }

    if (report.redirectedTo) {
      reportLines.push(`**Redirecionado para:** ${report.redirectedTo}\n`);
    }

    if (report.loginSuccess) {
      reportLines.push('### Páginas Testadas:\n');

      for (const [pageName, pageReport] of Object.entries(report.pages)) {
        const status = pageReport.accessible ? '✅' : '❌';
        reportLines.push(`#### ${status} ${pageName}`);

        if (pageReport.noPermission) {
          reportLines.push('- **Status:** SEM PERMISSÃO (redirecionado para /auth)');
        } else if (pageReport.accessible) {
          reportLines.push('- **Status:** Acessível');
          reportLines.push(`- **Carregou:** ${pageReport.loaded ? 'Sim' : 'Não'}`);
          reportLines.push(`- **Tem conteúdo:** ${pageReport.hasContent ? 'Sim' : 'Não'}`);

          if (pageReport.redirectedTo) {
            reportLines.push(`- **Redirecionado para:** ${pageReport.redirectedTo}`);
          }

          // Elementos específicos
          if (Object.keys(pageReport.elements).length > 0) {
            reportLines.push('- **Elementos encontrados:**');
            for (const [key, value] of Object.entries(pageReport.elements)) {
              reportLines.push(`  - ${key}: ${value}`);
            }
          }

          // Erros
          if (pageReport.errors.length > 0) {
            reportLines.push('- **Erros:**');
            pageReport.errors.slice(0, 3).forEach(err => {
              reportLines.push(`  - ${err}`);
            });
            if (pageReport.errors.length > 3) {
              reportLines.push(`  - ... e mais ${pageReport.errors.length - 3} erros`);
            }
          }
        } else {
          reportLines.push('- **Status:** Inacessível ou com erro');
          if (pageReport.errors.length > 0) {
            reportLines.push(`- **Erro:** ${pageReport.errors[0]}`);
          }
        }

        reportLines.push('');
      }
    }

    // Erros de console gerais
    if (report.consoleErrors.length > 0) {
      reportLines.push('### Erros de Console Gerais:\n');
      report.consoleErrors.slice(0, 5).forEach((err, i) => {
        reportLines.push(`${i + 1}. ${err}`);
      });
      if (report.consoleErrors.length > 5) {
        reportLines.push(`... e mais ${report.consoleErrors.length - 5} erros\n`);
      }
    }

    reportLines.push('\n' + '─'.repeat(80) + '\n\n');
  }

  // Comparação de permissões
  reportLines.push('## COMPARAÇÃO DE PERMISSÕES ENTRE USUÁRIOS\n');
  reportLines.push('| Página | Admin | Dentista | Recepcionista |');
  reportLines.push('|--------|-------|----------|---------------|');

  for (const pageConfig of PAGES) {
    const pageName = pageConfig.name;
    const adminAccess = allReports.admin?.pages[pageName]?.accessible ? '✅' : '❌';
    const dentistaAccess = allReports.dentista?.pages[pageName]?.accessible ? '✅' : '❌';
    const recepAccess = allReports.recepcionista?.pages[pageName]?.accessible ? '✅' : '❌';

    reportLines.push(`| ${pageName} | ${adminAccess} | ${dentistaAccess} | ${recepAccess} |`);
  }

  reportLines.push('\n\n═'.repeat(80) + '\n');
  reportLines.push('## SCREENSHOTS\n');
  reportLines.push(`Todas as screenshots foram salvas em: ${screenshotsDir}\n`);

  const reportContent = reportLines.join('\n');
  const reportPath = 'c:\\Users\\Thiago\\Desktop\\site clinca dentista\\RELATORIO_TESTES_COMPLETO.md';
  fs.writeFileSync(reportPath, reportContent, 'utf8');

  console.log(reportContent);
  console.log(`\n✅ Relatório completo salvo em: ${reportPath}`);

  return reportPath;
}

// EXECUTAR TESTES
(async () => {
  console.log('🚀 Iniciando testes automáticos do sistema...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshots: ${screenshotsDir}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const allReports = {};

  try {
    // Testar cada usuário
    for (const [userKey, userCredentials] of Object.entries(USERS)) {
      const userReport = await testLogin(browser, userCredentials, userCredentials.role);
      allReports[userKey] = userReport;
      await sleep(2000);
    }

    // Gerar relatório final
    await generateReport(allReports);

  } catch (error) {
    console.error('❌ Erro durante execução dos testes:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Testes concluídos!');
  }
})();
