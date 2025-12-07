import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000';

const USERS = {
  admin: { username: 'admin', password: 'admin123', role: 'Admin' },
  dentista: { username: 'dra.ana', password: 'dentista123', role: 'Dentista' },
  recepcionista: { username: 'maria', password: 'recep123', role: 'Recepcionista' }
};

const PAGES = [
  { name: 'Dashboard', urls: ['/dashboard', '/'] },
  { name: 'Pacientes', urls: ['/patients', '/pacientes'] },
  { name: 'Agenda', urls: ['/agenda', '/schedule'] },
  { name: 'Estoque', urls: ['/inventory', '/estoque'] },
  { name: 'Financeiro', urls: ['/financial', '/financeiro'] },
  { name: 'Configurações', urls: ['/configuracoes', '/settings'] }
];

const screenshotsDir = 'c:\\Users\\Thiago\\Desktop\\site clinca dentista\\test-screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, userRole, pageName, suffix = '') {
  const filename = `${userRole}_${pageName}${suffix}.png`.replace(/[\/\s]/g, '_');
  const filepath = path.join(screenshotsDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function testLogin(browser, userCredentials, userRole) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TESTANDO: ${userRole} (${userCredentials.username})`);
  console.log('='.repeat(70));

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

  const consoleErrors = [];
  const consoleWarnings = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`[Page Error] ${error.message}`);
  });

  page.on('requestfailed', request => {
    networkErrors.push(`${request.url()} - ${request.failure().errorText}`);
  });

  try {
    // TESTE DE LOGIN
    console.log(`\n[${userRole}] 1. Acessando página de login...`);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    const loginScreenshot = await takeScreenshot(page, userRole, 'Login', '_inicial');
    userReport.screenshots.push(loginScreenshot);

    // Preencher formulário
    console.log(`[${userRole}] 2. Preenchendo credenciais...`);

    // Tentar diferentes seletores para username
    const usernameSelectors = [
      'input[name="username"]',
      'input[type="text"]',
      'input[placeholder*="usuário" i]',
      'input[placeholder*="nome" i]'
    ];

    let usernameFilled = false;
    for (const selector of usernameSelectors) {
      try {
        const input = await page.$(selector);
        if (input) {
          await input.fill(userCredentials.username);
          usernameFilled = true;
          console.log(`[${userRole}]    Username preenchido com: ${selector}`);
          break;
        }
      } catch (e) {}
    }

    // Preencher senha
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="senha" i]'
    ];

    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const input = await page.$(selector);
        if (input) {
          await input.fill(userCredentials.password);
          passwordFilled = true;
          console.log(`[${userRole}]    Senha preenchida com: ${selector}`);
          break;
        }
      } catch (e) {}
    }

    if (!usernameFilled || !passwordFilled) {
      throw new Error('Não foi possível preencher os campos de login');
    }

    await sleep(500);
    await takeScreenshot(page, userRole, 'Login', '_preenchido');

    // Clicar no botão de login
    console.log(`[${userRole}] 3. Clicando no botão de login...`);
    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("Entrar")',
      'button:has-text("Login")',
      'button.login-button'
    ];

    let loginClicked = false;
    for (const selector of loginButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          loginClicked = true;
          console.log(`[${userRole}]    Botão clicado com: ${selector}`);
          break;
        }
      } catch (e) {}
    }

    if (!loginClicked) {
      throw new Error('Não foi possível clicar no botão de login');
    }

    // Aguardar mudança na URL ou no conteúdo da página
    console.log(`[${userRole}] 4. Aguardando resposta do login...`);
    await sleep(3000);

    const currentUrl = page.url();
    console.log(`[${userRole}]    URL atual: ${currentUrl}`);

    // Verificar se há mensagem de erro
    const errorSelectors = [
      '.error',
      '.alert-error',
      '[role="alert"]',
      '.error-message',
      'text=/erro|incorret|inválid/i'
    ];

    let hasError = false;
    for (const selector of errorSelectors) {
      try {
        const errorEl = await page.$(selector);
        if (errorEl) {
          const errorText = await errorEl.textContent();
          console.log(`[${userRole}]    ⚠ Mensagem de erro: ${errorText}`);
          userReport.loginError = errorText;
          hasError = true;
          break;
        }
      } catch (e) {}
    }

    await takeScreenshot(page, userRole, 'Login', '_apos_click');

    // Verificar se login foi bem-sucedido
    if (currentUrl.includes('/auth') && !currentUrl.includes('/dashboard')) {
      // Ainda está na página de login - verificar se mudou alguma coisa
      const bodyText = await page.textContent('body');

      if (hasError || bodyText.toLowerCase().includes('incorret') || bodyText.toLowerCase().includes('inválid')) {
        userReport.loginSuccess = false;
        userReport.loginError = userReport.loginError || 'Credenciais inválidas ou erro de autenticação';
        console.log(`[${userRole}] ❌ Login FALHOU - ${userReport.loginError}`);
        await takeScreenshot(page, userRole, 'Login', '_FALHOU');
      } else {
        // Pode ser SPA - verificar se o conteúdo mudou
        await sleep(2000);
        const hasDashboard = await page.$('nav, .navbar, .sidebar, .dashboard, [class*="dashboard"]');

        if (hasDashboard) {
          userReport.loginSuccess = true;
          userReport.redirectedTo = currentUrl;
          console.log(`[${userRole}] ✅ Login SUCESSO (SPA - sem mudança de URL)`);
          await takeScreenshot(page, userRole, 'Login', '_SUCESSO');
        } else {
          userReport.loginSuccess = false;
          userReport.loginError = 'Permaneceu na página de login sem mudanças';
          console.log(`[${userRole}] ❌ Login FALHOU - sem resposta`);
          await takeScreenshot(page, userRole, 'Login', '_FALHOU');
        }
      }
    } else {
      // URL mudou - login bem-sucedido
      userReport.loginSuccess = true;
      userReport.redirectedTo = currentUrl;
      console.log(`[${userRole}] ✅ Login SUCESSO - redirecionado para ${currentUrl}`);
      await takeScreenshot(page, userRole, 'Login', '_SUCESSO');
    }

    // Se login foi bem-sucedido, testar as páginas
    if (userReport.loginSuccess) {
      console.log(`\n[${userRole}] Iniciando testes de páginas...`);
      for (const pageConfig of PAGES) {
        await testPage(page, userRole, pageConfig, userReport);
      }
    }

  } catch (error) {
    console.log(`[${userRole}] ❌ ERRO: ${error.message}`);
    userReport.loginError = error.message;
    await takeScreenshot(page, userRole, 'Login', '_ERRO_EXCEPTION');
  }

  userReport.consoleErrors = [...new Set(consoleErrors)];
  userReport.consoleWarnings = [...new Set(consoleWarnings)];
  userReport.networkErrors = [...new Set(networkErrors)];

  await context.close();
  return userReport;
}

async function testPage(page, userRole, pageConfig, userReport) {
  const pageName = pageConfig.name;
  console.log(`\n  [${userRole}/${pageName}] Testando...`);

  const pageReport = {
    name: pageName,
    accessible: false,
    loaded: false,
    hasContent: false,
    errors: [],
    screenshots: [],
    elements: {}
  };

  for (const url of pageConfig.urls) {
    try {
      console.log(`    Tentando: ${url}`);

      const errors = [];
      page.removeAllListeners('console');
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      const currentUrl = page.url();

      // Verificar redirecionamento para auth
      if (currentUrl.includes('/auth')) {
        console.log(`    ⛔ SEM PERMISSÃO`);
        pageReport.accessible = false;
        pageReport.noPermission = true;
        await takeScreenshot(page, userRole, pageName, '_SEM_PERMISSAO');
        continue;
      }

      pageReport.accessible = true;
      pageReport.loaded = true;
      pageReport.actualUrl = currentUrl;

      const screenshot = await takeScreenshot(page, userRole, pageName);
      pageReport.screenshots.push(screenshot);

      // Verificar conteúdo
      const bodyText = await page.textContent('body');
      pageReport.hasContent = bodyText.length > 100;
      pageReport.bodyLength = bodyText.length;

      // Análise específica
      await analyzePage(page, pageName, pageReport);

      pageReport.errors = [...new Set(errors)];

      const statusIcon = pageReport.hasContent ? '✅' : '⚠️';
      console.log(`    ${statusIcon} Carregou - Conteúdo: ${pageReport.hasContent ? 'SIM' : 'VAZIO'}`);

      break;

    } catch (error) {
      console.log(`    ❌ Erro: ${error.message.split('\n')[0]}`);
      pageReport.errors.push(error.message);

      if (url === pageConfig.urls[pageConfig.urls.length - 1]) {
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
        pageReport.elements.cards = await page.locator('.card, [class*="Card"], [class*="card"]').count();
        pageReport.elements.metrics = await page.locator('[class*="metric"], [class*="Metric"]').count();
        pageReport.elements.hasCharts = await page.locator('canvas, svg').count() > 0;
        console.log(`      - Cards: ${pageReport.elements.cards}, Métricas: ${pageReport.elements.metrics}`);
        break;

      case 'Pacientes':
        pageReport.elements.hasTable = await page.locator('table, [role="table"]').count() > 0;
        pageReport.elements.rows = await page.locator('table tr, [role="row"]').count();
        pageReport.elements.hasAddButton = await page.locator('button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Cadastrar")').count() > 0;
        console.log(`      - Tabela: ${pageReport.elements.hasTable}, Linhas: ${pageReport.elements.rows}`);

        if (pageReport.elements.hasAddButton) {
          try {
            await page.click('button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Cadastrar")', { timeout: 2000 });
            await sleep(1000);
            pageReport.elements.modalOpens = await page.locator('[role="dialog"], .modal, [class*="Modal"]').count() > 0;
            console.log(`      - Modal abre: ${pageReport.elements.modalOpens ? 'SIM' : 'NÃO'}`);
            if (pageReport.elements.modalOpens) {
              await page.keyboard.press('Escape');
              await sleep(500);
            }
          } catch (e) {
            pageReport.elements.modalOpens = false;
          }
        }
        break;

      case 'Agenda':
        pageReport.elements.hasCalendar = await page.locator('[class*="calendar"], [class*="Calendar"], .fc').count() > 0;
        pageReport.elements.events = await page.locator('[class*="event"], [class*="Event"], .fc-event').count();
        console.log(`      - Calendário: ${pageReport.elements.hasCalendar ? 'SIM' : 'NÃO'}, Eventos: ${pageReport.elements.events}`);
        break;

      case 'Estoque':
        pageReport.elements.hasTable = await page.locator('table, [role="table"]').count() > 0;
        pageReport.elements.items = await page.locator('table tr, [role="row"]').count();
        pageReport.elements.isEmpty = pageReport.elements.items <= 1;
        console.log(`      - Itens: ${pageReport.elements.items}, Vazio: ${pageReport.elements.isEmpty ? 'SIM' : 'NÃO'}`);
        break;

      case 'Financeiro':
        pageReport.elements.hasTable = await page.locator('table, [role="table"]').count() > 0;
        pageReport.elements.transactions = await page.locator('table tr, [role="row"]').count();
        pageReport.elements.hasCharts = await page.locator('canvas, svg').count() > 0;
        console.log(`      - Transações: ${pageReport.elements.transactions}`);
        break;

      case 'Configurações':
        pageReport.elements.sections = await page.locator('section, [class*="section"]').count();
        pageReport.elements.tabs = await page.locator('[role="tab"], .tab, [class*="Tab"]').count();
        pageReport.elements.inputs = await page.locator('input, select, textarea').count();
        console.log(`      - Seções: ${pageReport.elements.sections}, Inputs: ${pageReport.elements.inputs}`);
        break;
    }
  } catch (error) {
    console.log(`      - Erro na análise: ${error.message}`);
  }
}

function generateReport(allReports) {
  console.log('\n\n' + '='.repeat(80));
  console.log('RELATÓRIO FINAL DE TESTES');
  console.log('='.repeat(80) + '\n');

  const lines = [];
  lines.push('# RELATÓRIO DE TESTES - SISTEMA CLÍNICA ODONTOLÓGICA\n');
  lines.push(`**Data/Hora:** ${new Date().toLocaleString('pt-BR')}\n`);
  lines.push(`**URL Base:** ${BASE_URL}\n`);
  lines.push('---\n\n');

  // RESUMO EXECUTIVO
  lines.push('## RESUMO EXECUTIVO\n');
  lines.push('| Usuário | Login | Páginas Acessíveis | Erros Console |');
  lines.push('|---------|-------|-------------------|---------------|');

  for (const [key, report] of Object.entries(allReports)) {
    const login = report.loginSuccess ? '✅ Sucesso' : '❌ Falhou';
    const accessible = Object.values(report.pages).filter(p => p.accessible).length;
    const total = Object.keys(report.pages).length;
    const errors = report.consoleErrors.length;
    lines.push(`| ${report.role} | ${login} | ${accessible}/${total} | ${errors} |`);
  }
  lines.push('\n---\n\n');

  // DETALHES POR USUÁRIO
  for (const [key, report] of Object.entries(allReports)) {
    lines.push(`## ${report.role.toUpperCase()} (${report.username})\n`);

    lines.push(`### Status de Login\n`);
    if (report.loginSuccess) {
      lines.push(`✅ **Login bem-sucedido**\n`);
      if (report.redirectedTo) {
        lines.push(`- Redirecionado para: \`${report.redirectedTo}\`\n`);
      }
    } else {
      lines.push(`❌ **Login falhou**\n`);
      if (report.loginError) {
        lines.push(`- Erro: ${report.loginError}\n`);
      }
    }
    lines.push('\n');

    if (report.loginSuccess && Object.keys(report.pages).length > 0) {
      lines.push('### Páginas Testadas\n\n');

      for (const [pageName, pageReport] of Object.entries(report.pages)) {
        const icon = pageReport.accessible ? (pageReport.hasContent ? '✅' : '⚠️') : '❌';
        lines.push(`#### ${icon} ${pageName}\n`);

        if (pageReport.noPermission) {
          lines.push('- **Status:** SEM PERMISSÃO (redirecionado para /auth)\n');
        } else if (pageReport.accessible) {
          lines.push('- **Status:** Acessível\n');
          lines.push(`- **Carregou:** Sim\n`);
          lines.push(`- **Tem Conteúdo:** ${pageReport.hasContent ? 'Sim' : 'Não (página vazia)'}\n`);
          lines.push(`- **Tamanho do conteúdo:** ${pageReport.bodyLength} caracteres\n`);

          if (Object.keys(pageReport.elements).length > 0) {
            lines.push('- **Elementos:**\n');
            for (const [key, value] of Object.entries(pageReport.elements)) {
              lines.push(`  - ${key}: ${value}\n`);
            }
          }

          if (pageReport.errors.length > 0) {
            lines.push('- **Erros:**\n');
            pageReport.errors.slice(0, 3).forEach(err => {
              lines.push(`  - ${err.substring(0, 100)}\n`);
            });
          }
        } else {
          lines.push('- **Status:** Inacessível\n');
          if (pageReport.errors.length > 0) {
            lines.push(`- **Erro:** ${pageReport.errors[0].substring(0, 150)}\n`);
          }
        }
        lines.push('\n');
      }
    }

    // Erros de console
    if (report.consoleErrors.length > 0) {
      lines.push('### Erros de Console\n\n');
      const uniqueErrors = [...new Set(report.consoleErrors.filter(e => !e.includes('replit')))];
      uniqueErrors.slice(0, 5).forEach((err, i) => {
        lines.push(`${i + 1}. ${err}\n`);
      });
      if (uniqueErrors.length > 5) {
        lines.push(`\n... e mais ${uniqueErrors.length - 5} erros\n`);
      }
      lines.push('\n');
    }

    lines.push('---\n\n');
  }

  // COMPARAÇÃO DE PERMISSÕES
  lines.push('## COMPARAÇÃO DE PERMISSÕES\n\n');
  lines.push('| Página | Admin | Dentista | Recepcionista |');
  lines.push('|--------|-------|----------|---------------|');

  for (const pageConfig of PAGES) {
    const pageName = pageConfig.name;
    const admin = allReports.admin?.pages[pageName]?.accessible ? '✅' : '❌';
    const dentista = allReports.dentista?.pages[pageName]?.accessible ? '✅' : '❌';
    const recep = allReports.recepcionista?.pages[pageName]?.accessible ? '✅' : '❌';
    lines.push(`| ${pageName} | ${admin} | ${dentista} | ${recep} |`);
  }
  lines.push('\n\n---\n\n');

  lines.push(`## SCREENSHOTS\n\nTodas as screenshots salvas em: \`${screenshotsDir}\`\n`);

  const reportContent = lines.join('');
  const reportPath = 'c:\\Users\\Thiago\\Desktop\\site clinca dentista\\RELATORIO_TESTES_COMPLETO.md';
  fs.writeFileSync(reportPath, reportContent, 'utf8');

  console.log(reportContent);
  console.log(`\n✅ Relatório salvo em: ${reportPath}\n`);

  return reportPath;
}

// EXECUTAR
(async () => {
  console.log('🚀 INICIANDO TESTES AUTOMATIZADOS\n');
  console.log(`URL: ${BASE_URL}`);
  console.log(`Screenshots: ${screenshotsDir}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });

  const allReports = {};

  try {
    for (const [key, credentials] of Object.entries(USERS)) {
      const report = await testLogin(browser, credentials, credentials.role);
      allReports[key] = report;
      await sleep(1000);
    }

    generateReport(allReports);

  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    await browser.close();
    console.log('\n✅ TESTES CONCLUÍDOS!\n');
  }
})();
