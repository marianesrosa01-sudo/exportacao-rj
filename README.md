# RJ & Alliance Exports — versão 2

## Publicação
Faça backup do banco de dados e dos arquivos atuais antes de atualizar. Extraia o ZIP e envie os arquivos da raiz para a branch main do repositório GitHub existente. Inclua style.css. A Vercel deve executar npm install e npm run build, publicando dist. Não crie outro projeto nem outro banco.

## Nuvem
Mantém URL e chave anon do Supabase original. Utiliza as tabelas existentes processos e arquivos e bucket arquivos. Não executa migrações nem importação automática. Os dados comerciais iniciais foram retirados do código público; os registros existentes no banco não são alterados por esta atualização. Caso o banco esteja vazio, verifique o projeto e as permissões antes de importar qualquer dado.

Verifique no Supabase se RLS está habilitado nas tabelas e se somente usuários autorizados possuem acesso. Não habilite acesso anon às informações comerciais. Revise também as políticas do Storage e torne o bucket arquivos privado (o aplicativo agora utiliza URLs assinadas para abrir os documentos). Não substitua a chave anon por uma chave service_role. As políticas dependem dos usuários autorizados da empresa e precisam ser verificadas no projeto existente. A remoção de anexos remove o registro da lista, mas não apaga fisicamente o objeto no Storage, preservando o arquivo para recuperação administrativa.

## Testes após publicação
1. Login com conta autorizada; confira os registros existentes.
2. Clique em cada indicador do painel e confira a lista/filtragem.
3. Crie um processo de teste, edite os dados e confira em outro dispositivo após atualizar.
4. Envie e abra um documento de teste; confirme permissões de acesso.
5. Confira que o acesso sem login não permite ler dados nem baixar documentos privados.

Validação local: transpilação TSX sem diagnósticos sintáticos. Dependências npm indisponíveis no cache local; build completo e testes com Supabase/Vercel ainda pendentes.
