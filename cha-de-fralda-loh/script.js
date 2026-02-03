// --- CONFIGURAÇÃO DO SUPABASE ---
// Substitua pelos seus dados reais do Project Settings > API
const SUPABASE_URL = 'https://harrktyowftlwttpjanx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_K4IAl57ZQnNU6bBLgE3MPg_VbWNHfqi';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO DA APLICAÇÃO ---
let usuario = { nome: '', tel: '' };
let carrinhoIds = new Set();    // IDs dos itens do catálogo selecionados
let itensCustomizados = [];     // Array de Strings (nomes dos itens personalizados)
let pixAtivo = false;           // Booleano se o PIX está selecionado

// --- FUNÇÃO 1: NAVEGAÇÃO E IDENTIFICAÇÃO ---
async function irParaLista() {
    const nomeInput = document.getElementById('input-nome');
    const telInput = document.getElementById('input-tel');
    
    const nome = nomeInput.value.trim();
    const tel = telInput.value.trim();

    // Validação simples
    if (nome.length < 3 || tel.length < 8) {
        alert("Por favor, preencha seu nome e telefone corretamente para continuar.");
        return;
    }

    usuario.nome = nome;
    usuario.tel = tel;

    // Troca de telas
    document.getElementById('step-1').classList.add('hidden');
    document.getElementById('step-2').classList.remove('hidden');
    
    // Inicia carregamento de dados
    await Promise.all([
        carregarDashboardAoVivo(), 
        carregarCatalogo()
    ]);
}

// --- FUNÇÃO 2: CARREGAR O CATÁLOGO DO BANCO ---
async function carregarCatalogo() {
    const { data, error } = await _supabase
        .from('catalogo')
        .select('*')
        .order('nome');

    if (error) {
        console.error("Erro ao carregar catálogo:", error);
        return;
    }

    const grid = document.getElementById('grid-catalogo');
    grid.innerHTML = '';

    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-presente';
        div.id = `cat-${item.id}`; // ID único para manipulação DOM
        div.innerHTML = `<span>${item.nome}</span>`;
        
        // Evento de clique
        div.onclick = () => toggleCatalogo(item.id);
        
        grid.appendChild(div);
    });
}

// --- FUNÇÃO 3: DASHBOARD AO VIVO (TOPO) ---
async function carregarDashboardAoVivo() {
    // Busca apenas as colunas necessárias para economizar dados
    const { data, error } = await _supabase
        .from('contribuicoes')
        .select('item_nome, valor_pix');

    if (error) return console.error(error);

    // Processamento dos dados
    const contagem = {};
    let totalPix = 0;

    data.forEach(reg => {
        if (reg.valor_pix > 0) {
            totalPix += reg.valor_pix;
        } else if (reg.item_nome) {
            // Conta quantas vezes o item aparece
            contagem[reg.item_nome] = (contagem[reg.item_nome] || 0) + 1;
        }
    });

    // Renderiza Itens
    const container = document.getElementById('ticker-itens');
    
    if (Object.keys(contagem).length === 0) {
        container.innerHTML = "<em>Nenhum presente confirmado ainda. Seja o primeiro!</em>";
    } else {
        // Gera as badges (ex: 3x Fralda P)
        const htmlItens = Object.entries(contagem)
            .map(([nome, qtd]) => {
                return `<span class="badge-dash"><strong>${qtd}x</strong> ${nome}</span>`;
            })
            .join(' ');
        container.innerHTML = htmlItens;
    }

    // Renderiza Total PIX
    document.getElementById('ticker-pix').innerText = 
        totalPix.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- FUNÇÃO 4: SELEÇÃO DE ITENS DO CATÁLOGO ---
function toggleCatalogo(id) {
    const el = document.getElementById(`cat-${id}`);
    
    if (carrinhoIds.has(id)) {
        carrinhoIds.delete(id);
        el.classList.remove('selecionado');
    } else {
        carrinhoIds.add(id);
        el.classList.add('selecionado');
    }
    atualizarBarraConfirmacao();
}

// --- FUNÇÃO 5: ITENS PERSONALIZADOS (OUTROS) ---
function adicionarCustom() {
    const input = document.getElementById('custom-input');
    const nomeItem = input.value.trim();
    
    if (!nomeItem) return alert("Digite o nome do presente antes de adicionar.");

    itensCustomizados.push(nomeItem);
    input.value = ""; // Limpa input
    
    renderizarCustom();
    atualizarBarraConfirmacao();
}

function removerCustom(index) {
    itensCustomizados.splice(index, 1);
    renderizarCustom();
    atualizarBarraConfirmacao();
}

function renderizarCustom() {
    const container = document.getElementById('lista-custom');
    container.innerHTML = itensCustomizados.map((item, index) => `
        <span class="tag-custom">
            ${item} 
            <button onclick="removerCustom(${index})">x</button>
        </span>
    `).join('');
}

// --- FUNÇÃO 6: CONTROLE DO PIX ---
function togglePix() {
    pixAtivo = !pixAtivo;
    const configEl = document.getElementById('config-pix');
    const cardEl = document.getElementById('card-pix');
    
    if (pixAtivo) {
        configEl.classList.remove('hidden');
        cardEl.classList.add('selecionado-pix');
    } else {
        configEl.classList.add('hidden');
        cardEl.classList.remove('selecionado-pix');
        document.getElementById('valor-pix-input').value = ""; // Reseta valor
    }
    atualizarBarraConfirmacao();
}

function copiarPix() {
    const chave = document.getElementById('chave-pix-texto').innerText;
    navigator.clipboard.writeText(chave);
    alert("Chave PIX copiada para a área de transferência!");
}

// --- FUNÇÃO 7: BARRA INFERIOR E FINALIZAÇÃO ---
function atualizarBarraConfirmacao() {
    const totalSelecionados = carrinhoIds.size + itensCustomizados.length + (pixAtivo ? 1 : 0);
    const barra = document.getElementById('bar-confirmacao');
    
    if (totalSelecionados > 0) {
        barra.classList.remove('hidden');
        document.getElementById('contador-itens').innerText = `${totalSelecionados} item(ns) selecionado(s)`;
    } else {
        barra.classList.add('hidden');
    }
}

async function finalizarEscolhas() {
    if (!confirm("Confirmar todas as escolhas?")) return;

    // Array que será enviado ao banco
    const envios = [];

    // 1. Processa itens do Catálogo
    // Precisamos pegar o NOME que está dentro da div, pois salvamos o ID no Set
    carrinhoIds.forEach(id => {
        const nomeItem = document.getElementById(`cat-${id}`).innerText;
        envios.push({ 
            nome_convidado: usuario.nome, 
            telefone_convidado: usuario.tel, 
            item_nome: nomeItem,
            valor_pix: 0 
        });
    });

    // 2. Processa itens Personalizados
    itensCustomizados.forEach(nome => {
        envios.push({ 
            nome_convidado: usuario.nome, 
            telefone_convidado: usuario.tel, 
            item_nome: nome,
            valor_pix: 0 
        });
    });

    // 3. Processa PIX
    if (pixAtivo) {
        const valorInput = document.getElementById('valor-pix-input').value;
        const valorPix = parseFloat(valorInput);

        if (!valorPix || valorPix <= 0) {
            return alert("Por favor, informe o valor do PIX ou desmarque a opção.");
        }

        envios.push({ 
            nome_convidado: usuario.nome, 
            telefone_convidado: usuario.tel, 
            item_nome: 'Contribuição PIX', 
            valor_pix: valorPix 
        });
    }

    // Envio em Lote (Batch Insert)
    const { error } = await _supabase
        .from('contribuicoes')
        .insert(envios);

    if (error) {
        console.error(error);
        alert("Ocorreu um erro ao salvar. Tente novamente.");
    } else {
        // Sucesso
        document.getElementById('step-2').classList.add('hidden');
        document.getElementById('bar-confirmacao').classList.add('hidden');
        document.getElementById('step-3').classList.remove('hidden');
        document.getElementById('nome-final').innerText = usuario.nome;
    }
}