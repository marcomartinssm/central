// Dados de mentira, iguais nas 3 opções, só para comparar o visual.
window.DADOS = {
  saudacao: "Boa tarde, Marco",
  data: "quinta-feira, 29 de outubro",
  agora: "15:42",
  ultimaFala: { voce: "amanhã às 10 ligar pro João inquilino da rua XV, importante", central: "Criei a tarefa importante de ligar para o João amanhã às 10:00, na área Aluguel. Às 9:00 você tem visita na obra Morro dos Conventos." },
  hoje: [
    { hora: "09:00", titulo: "Visita apto Centro", tipo: "agenda", area: "Google Agenda" },
    { hora: "10:00", titulo: "Reunião com Thainara sobre fichas", tipo: "tarefa", area: "Comercial de locação", feita: true },
    { hora: "14:30", titulo: "Conferir medição da obra", tipo: "tarefa", area: "Obras", importante: true },
    { hora: "17:00", titulo: "Reunião com contador", tipo: "agenda", area: "Google Agenda" },
    { hora: "", titulo: "Renovar apólice cliente Silva", tipo: "tarefa", area: "Seguralta" },
  ],
  atrasadas: [
    { titulo: "Pagar seguro do carro", area: "Finanças pessoais", quando: "ontem", importante: true },
    { titulo: "Ligar pro proprietário do 302", area: "Aluguel", quando: "há 2 dias" },
  ],
  areas: [
    { icone: "🏡", nome: "Pessoal", abertas: 3, atrasadas: 1, hoje: 0 },
    { icone: "🏢", nome: "Projetar Imóveis", abertas: 7, atrasadas: 1, hoje: 1 },
    { icone: "🏗️", nome: "Construtora", abertas: 4, atrasadas: 0, hoje: 1 },
    { icone: "🛡️", nome: "Seguralta", abertas: 2, atrasadas: 0, hoje: 1 },
    { icone: "✨", nome: "Estética Morgana", abertas: 1, atrasadas: 0, hoje: 0 },
  ],
  semana: [
    { dia: "Amanhã", itens: [{ hora: "09:00", titulo: "Visita obra Morro dos Conventos", tipo: "agenda" }, { hora: "10:00", titulo: "Ligar pro João — atraso do aluguel", tipo: "tarefa", importante: true }] },
    { dia: "Sábado, 31", itens: [{ hora: "19:00", titulo: "Degustação do buffet", tipo: "tarefa" }] },
    { dia: "Segunda, 2", itens: [{ hora: "", titulo: "Pedir orçamento de telha", tipo: "tarefa" }] },
  ],
  numeros: { abertas: 17, hoje: 5, atrasadas: 2, feitasSemana: 12 },
};
