import { pack } from './store.js';
import { getRules } from './policy.js';
const WCAG='https://www.w3.org/WAI/WCAG22/quickref/';
const REACT='https://react.dev/reference/react/ViewTransition';
export const DESIGN_GUIDES=[
 {id:'accessibility',tags:['acessibilidade','accessibility','teclado','foco','contraste'],title:'Acesso e navegação',source:WCAG,checks:['Nome acessível nos controles e alternativas para imagens relevantes.','Fluxo completo por teclado, foco visível e ordem coerente.','Contraste, zoom e leitura sem depender apenas de cor.'],example:'<button type="button" aria-label="Fechar painel">×</button>'},
 {id:'forms',tags:['form','formulário','input','erro','validation'],title:'Formulários e recuperação',source:WCAG,checks:['Rótulos associados e identificação de erros por campo.','Resumo de falhas com caminho de correção.','Preservar preenchimento após erro; comunicar resultado.'],example:'<label for="email">E-mail</label><input id="email" aria-describedby="email-error"><p id="email-error">Informe um endereço válido.</p>'},
 {id:'navigation',tags:['navegação','navigation','menu','tab','route'],title:'Estrutura de navegação',source:'App Memory: orientação de produto',checks:['Agrupar pelo objetivo do usuário.','Indicar localização e próxima ação.','Oferecer retorno sem perda de estado.'],example:'Lista → detalhe → edição → confirmação; manter filtro da lista ao voltar.'},
 {id:'states',tags:['loading','empty','vazio','erro','estado','skeleton'],title:'Estados de uma tarefa',source:'App Memory: orientação de produto',checks:['Especificar inicial, carregando, vazio, erro, sucesso e indisponibilidade.','Erro deve ter recuperação pertinente.','Evitar indicador de progresso inventado.'],example:'Vazio: explique a ausência e ofereça a primeira ação. Erro: mantenha contexto e permita tentar novamente.'},
 {id:'responsive',tags:['responsive','responsivo','mobile','overflow','tela'],title:'Adaptação a espaço e conteúdo',source:'App Memory: orientação de produto',checks:['Testar largura pequena e conteúdo longo.','Priorizar conteúdo e ações essenciais.','Conferir overflow, teclado virtual e zoom.'],example:'Grid: repeat(auto-fit,minmax(min(100%,18rem),1fr)); evitar largura fixa nos campos.'},
 {id:'tokens',tags:['token','tema','theme','cores','design system'],title:'Consistência visual',source:'App Memory: orientação de produto',checks:['Usar tokens de cor, espaçamento e tipografia do projeto.','Projetar todos os estados nos temas exigidos.','Reutilizar componentes existentes antes de introduzir novos.'],example:':root { --space-control: .75rem; --radius-control: .5rem; }'},
 {id:'data',tags:['table','tabela','dashboard','gráfico','chart'],title:'Dados e decisões',source:'App Memory: orientação de produto',checks:['Unidades, período e origem explícitos.','Estado de ausência de dados distinto de valor zero.','Filtros e atualização visíveis, sem arredondamento enganoso.'],example:'Tabela de pedidos: período, moeda, total e seleção claramente identificados.'},
 {id:'motion',tags:['animation','animação','transition','transição','react','motion'],title:'Movimento com propósito',source:REACT,checks:['Associar animação à continuidade da interação.','Usar identidade estável ao compartilhar elementos.','Oferecer comportamento com movimento reduzido.'],example:'Consultar get_react_view_transitions para React; não assumir suporte somente pela presença de JSX.'}
];
export function designGuidance(store,projectId,topic,detail='standard'){
 const folded=topic.toLocaleLowerCase();let guides=DESIGN_GUIDES.filter(g=>g.tags.some(t=>folded.includes(t)));if(!guides.length)guides=DESIGN_GUIDES.filter(g=>['accessibility','states','responsive'].includes(g.id));
 const references=store.search(projectId,topic,8,'spec');
 return {classification:'GUIDE_REFERENCE',topic,corpus_version:'2026-10-23',guides:guides.map(g=>detail==='full'?g:({id:g.id,title:g.title,checks:g.checks,source:g.source})),available_topics:DESIGN_GUIDES.map(g=>g.id),rules:getRules(store,projectId,'ui'),project_references:pack(references,{budget:detail==='full'?3000:1200}),validation:['Inspecionar a interface renderizada e o fluxo real.','Registrar plataforma, tema, teclado, viewport e evidência.','Declarar o que permaneceu sem verificação.'],limits:'Corpus próprio de orientação; não distribui skills de terceiros nem comprova conformidade por consulta.'};
}
const examples={
 shared_element:`import {ViewTransition, startTransition, useState} from 'react';
export function Gallery({photo}) {
 const [detail,setDetail]=useState(false);
 return <><button onClick={()=>startTransition(()=>setDetail(!detail))}>Alternar</button>
 {detail ? <ViewTransition key="detail" name={\`photo-\${photo.id}\`}><img src={photo.large} alt={photo.alt}/></ViewTransition>
 : <ViewTransition key="thumb" name={\`photo-\${photo.id}\`}><img src={photo.thumb} alt={photo.alt}/></ViewTransition>}</>;
}`,
 list_reorder:`const [items,setItems]=useState(initial);
<button onClick={()=>startTransition(()=>setItems(old=>[...old].reverse()))}>Inverter</button>
<ul>{items.map(item=><ViewTransition key={item.id}><li>{item.label}</li></ViewTransition>)}</ul>`,
 enter_exit:`{visible && <ViewTransition enter="auto" exit="auto" default="none"><section>Detalhes</section></ViewTransition>}
// Atualize visible em startTransition; valide a colocação do boundary com os elementos reais.`,
 suspense:`<ViewTransition><Suspense fallback={<p>Carregando…</p>}><Content/></Suspense></ViewTransition>`,
 route_change:`// Exemplo independente de router: adapte às APIs oficiais do router escolhido.
const [page,setPage]=useState('list');
<button onClick={()=>startTransition(()=>setPage('detail'))}>Abrir</button>
<ViewTransition>{page==='list'?<List/>:<Detail/>}</ViewTransition>`
};
export function reactTransitions(store,projectId,{topic,detail='standard'}={}){
 store.project(projectId);const manifest=store.db.prepare("SELECT content FROM records WHERE project_id=? AND source_path='package.json' AND status='observed'").get(projectId);let declared=null;try{const d=JSON.parse(manifest?.content??'{}');declared=d.dependencies?.react??d.devDependencies?.react??null;}catch{}
 const selected=topic?Object.fromEntries(Object.entries(examples).filter(([key])=>key.includes(topic.replaceAll(' ','_')))):examples;
 return {classification:'GUIDE_REFERENCE',source:REACT,checked_at:'2026-10-23',react_declared:declared,availability:'Referência consultada React19.3; conferir versão instalada e suporte do navegador antes de aplicar.',patterns:Object.keys(examples),rules:['Atualizações de estado devem participar de uma Transition/Suspense.','React coordena document.startViewTransition; evite iniciá-la paralelamente.','Nomes de elementos compartilhados precisam ter identidade coerente e não duplicada.'],examples:detail==='full'?selected:{[Object.keys(selected)[0]??'route_change']:Object.values(selected)[0]??examples.route_change},reduced_motion_css:'@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } }',validation:['Testar troca de tela e fallback sem suporte.','Conferir foco, leitor de tela, movimento reduzido e identidade.','Não declarar animação validada sem renderizar.']};
}
