import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:5000';
const SCREENSHOTS_DIR = join(process.cwd(), 'qa-screenshots');

// Criar diretório de screenshots se não existir
import { mkdirSync } from 'fs';
try {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
} catch (e) {
  // Diretório já existe
}

const testResults = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  pages: []
};

async function testPage(page, route, name, options = {}) {
  const result = {
    name,
    route,
    status: 'passed',
    errors: [],
    warnings: [],
    consoleErrors: [],
    networkErrors: [],
    loadTime: 0,
    screenshot: null
  };

  testResults.summary.total++;

  const startTime = Date.now();

  try {
    console.log(`\n[Testando] ${name} (${route})`);

    // Capturar erros de console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        result.consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capturar erros de rede
    page.on('requestfailed', request => {
      result.networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText || 'Unknown error'
      });
    });

    // Navegar para a página
    const response = await page.goto(`${BASE_URL}${route}`, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: options.timeout || 30000
    });

    result.loadTime = Date.now() - startTime;

    // Verificar status HTTP
    if (response && !response.ok()) {
      result.warnings.push(`HTTP Status: ${response.status()}`);
      testResults.summary.warnings++;
    }

    // Aguardar um pouco para JS executar
    await page.waitForTimeout(2000);

    // Verificar se há elementos de erro visíveis
    const errorElements = await page.$$('[class*="error"], [role="alert"]');
    if (errorElements.length > 0) {
      for (const el of errorElements) {
        const text = await el.textContent();
        if (text && text.trim()) {
          result.warnings.push(`Elemento de erro encontrado: ${text.trim().substring(0, 100)}`);
        }
      }
    }

    // Verificar título da página
    const title = await page.title();
    result.pageTitle = title;

    // Tirar screenshot
    const screenshotPath = join(SCREENSHOTS_DIR, `${name.replace(/[^a-z0-9]/gi, '_')}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    result.screenshot = screenshotPath;

    // Verificar se há erros críticos
    if (result.consoleErrors.length > 0 || result.networkErrors.length > 0) {
      result.status = 'failed';
      result.errors.push(`${result.consoleErrors.length} erros de console, ${result.networkErrors.length} erros de rede`);
      testResults.summary.failed++;
    } else if (result.warnings.length > 0) {
      result.status = 'warning';
      testResults.summary.warnings++;
      testResults.summary.passed++; // Ainda conta como passou, mas com avisos
    } else {
      testResults.summary.passed++;
    }

    console.log(`  ✓ Status: ${result.status}`);
    console.log(`  ✓ Tempo de carga: ${result.loadTime}ms`);
    console.log(`  ✓ Erros de console: ${result.consoleErrors.length}`);
    console.log(`  ✓ Erros de rede: ${result.networkErrors.length}`);
    console.log(`  ✓ Avisos: ${result.warnings.length}`);

  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
    result.loadTime = Date.now() - startTime;
    testResults.summary.failed++;

    console.log(`  ✗ FALHOU: ${error.message}`);

    // Tentar tirar screenshot mesmo com erro
    try {
      const screenshotPath = join(SCREENSHOTS_DIR, `ERROR_${name.replace(/[^a-z0-9]/gi, '_')}.png`);
      await page.screenshot({ path: screenshotPath });
      result.screenshot = screenshotPath;
    } catch (e) {
      console.log(`  ✗ Não foi possível capturar screenshot do erro`);
    }
  }

  testResults.pages.push(result);
  return result;
}

async function testLoginFlow(page) {
  console.log('\n=== TESTANDO FLUXO DE LOGIN ===');

  const result = {
    name: 'Fluxo de Login',
    route: '/auth',
    status: 'passed',
    errors: [],
    warnings: [],
    steps: []
  };

  try {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForTimeout(1000);

    // Verificar se há campos de login
    const emailInput = await page.$('input[type="email"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');

    if (emailInput && passwordInput) {
      result.steps.push('Campos de login encontrados');

      // Tentar encontrar botão de login
      const loginButton = await page.$('button[type="submit"]');
      if (loginButton) {
        result.steps.push('Botão de submit encontrado');
      } else {
        result.warnings.push('Botão de submit não encontrado');
      }
    } else {
      result.errors.push('Campos de login não encontrados na página');
      result.status = 'failed';
    }

    // Screenshot da página de login
    const screenshotPath = join(SCREENSHOTS_DIR, 'login_page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshot = screenshotPath;

  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
  }

  testResults.pages.push(result);
  return result;
}

async function runTests() {
  console.log('==============================================');
  console.log('INICIANDO TESTES DE QA DO FRONTEND');
  console.log('==============================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Diretório de screenshots: ${SCREENSHOTS_DIR}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Testes das páginas principais
  const pagesToTest = [
    { route: '/auth', name: 'Login/Registro', waitUntil: 'networkidle' },
    { route: '/dashboard', name: 'Dashboard Principal' },
    { route: '/agenda', name: 'Agenda de Consultas' },
    { route: '/patients', name: 'Listagem de Pacientes' },
    { route: '/cadastros', name: 'Cadastros Gerais' },
    { route: '/inventory', name: 'Controle de Estoque' },
    { route: '/financial', name: 'Módulo Financeiro' },
    { route: '/configuracoes', name: 'Configurações' },
    { route: '/schedule', name: 'Schedule (Agenda Alternativa)' },
    { route: '/analytics', name: 'Analytics/Relatórios' },
    { route: '/automation', name: 'Automação' },
    { route: '/prosthesis', name: 'Controle de Próteses' },
    { route: '/crm', name: 'CRM' },
    { route: '/atendimento', name: 'Chat/Atendimento' },
  ];

  // Primeiro testar a página de login
  await testLoginFlow(page);

  // Testar todas as outras páginas (sem autenticação)
  for (const pageConfig of pagesToTest) {
    await testPage(page, pageConfig.route, pageConfig.name, {
      waitUntil: pageConfig.waitUntil || 'domcontentloaded'
    });
  }

  await browser.close();

  // Gerar relatório
  console.log('\n==============================================');
  console.log('RESUMO DOS TESTES');
  console.log('==============================================');
  console.log(`Total de páginas testadas: ${testResults.summary.total}`);
  console.log(`Passou: ${testResults.summary.passed}`);
  console.log(`Falhou: ${testResults.summary.failed}`);
  console.log(`Com avisos: ${testResults.summary.warnings}`);

  // Salvar relatório JSON
  const reportPath = join(process.cwd(), 'qa-test-report.json');
  writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nRelatório completo salvo em: ${reportPath}`);

  // Gerar relatório em markdown
  const mdReport = generateMarkdownReport(testResults);
  const mdReportPath = join(process.cwd(), 'qa-test-report.md');
  writeFileSync(mdReportPath, mdReport);
  console.log(`Relatório Markdown salvo em: ${mdReportPath}`);

  console.log('\n=== PÁGINAS COM FALHAS ===');
  testResults.pages.filter(p => p.status === 'failed').forEach(p => {
    console.log(`\n${p.name} (${p.route})`);
    p.errors.forEach(e => console.log(`  - ${e}`));
    if (p.consoleErrors.length > 0) {
      console.log(`  Console Errors (${p.consoleErrors.length}):`);
      p.consoleErrors.slice(0, 3).forEach(e => console.log(`    - ${e.text}`));
    }
  });

  console.log('\n=== PÁGINAS COM AVISOS ===');
  testResults.pages.filter(p => p.warnings.length > 0).forEach(p => {
    console.log(`\n${p.name} (${p.route})`);
    p.warnings.forEach(w => console.log(`  - ${w}`));
  });

  return testResults;
}

function generateMarkdownReport(results) {
  let md = `# Relatório de QA - Frontend da Clínica Odontológica\n\n`;
  md += `**Data:** ${new Date(results.timestamp).toLocaleString('pt-BR')}\n\n`;
  md += `**Base URL:** ${results.baseUrl}\n\n`;

  md += `## Resumo\n\n`;
  md += `- **Total de páginas testadas:** ${results.summary.total}\n`;
  md += `- **Passou:** ${results.summary.passed}\n`;
  md += `- **Falhou:** ${results.summary.failed}\n`;
  md += `- **Com avisos:** ${results.summary.warnings}\n\n`;

  md += `## Detalhes por Página\n\n`;

  results.pages.forEach(page => {
    const statusIcon = page.status === 'passed' ? '✅' : page.status === 'warning' ? '⚠️' : '❌';
    md += `### ${statusIcon} ${page.name}\n\n`;
    md += `- **Rota:** \`${page.route}\`\n`;
    md += `- **Status:** ${page.status}\n`;
    if (page.loadTime) {
      md += `- **Tempo de carga:** ${page.loadTime}ms\n`;
    }
    if (page.pageTitle) {
      md += `- **Título da página:** ${page.pageTitle}\n`;
    }

    if (page.errors && page.errors.length > 0) {
      md += `\n**Erros:**\n`;
      page.errors.forEach(e => md += `- ${e}\n`);
    }

    if (page.warnings && page.warnings.length > 0) {
      md += `\n**Avisos:**\n`;
      page.warnings.forEach(w => md += `- ${w}\n`);
    }

    if (page.consoleErrors && page.consoleErrors.length > 0) {
      md += `\n**Erros de Console (${page.consoleErrors.length}):**\n`;
      page.consoleErrors.slice(0, 5).forEach(e => {
        md += `- ${e.text}\n`;
        if (e.location) {
          md += `  - Local: ${JSON.stringify(e.location)}\n`;
        }
      });
      if (page.consoleErrors.length > 5) {
        md += `- ... e mais ${page.consoleErrors.length - 5} erros\n`;
      }
    }

    if (page.networkErrors && page.networkErrors.length > 0) {
      md += `\n**Erros de Rede (${page.networkErrors.length}):**\n`;
      page.networkErrors.slice(0, 5).forEach(e => {
        md += `- ${e.url}: ${e.failure}\n`;
      });
      if (page.networkErrors.length > 5) {
        md += `- ... e mais ${page.networkErrors.length - 5} erros\n`;
      }
    }

    if (page.steps && page.steps.length > 0) {
      md += `\n**Passos executados:**\n`;
      page.steps.forEach(s => md += `- ${s}\n`);
    }

    if (page.screenshot) {
      md += `\n**Screenshot:** \`${page.screenshot}\`\n`;
    }

    md += `\n---\n\n`;
  });

  return md;
}

// Executar testes
runTests().catch(error => {
  console.error('Erro fatal durante os testes:', error);
  process.exit(1);
});
