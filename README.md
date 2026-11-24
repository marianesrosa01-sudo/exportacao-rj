# RJ & Alliance Exports

## Publicação no endereço existente
1. Extraia o ZIP e substitua os arquivos na raiz do repositório Git conectado ao projeto exportacao-rj na Vercel. Remova os nomes antigos App 2.tsx, index 2.html e vite_config.js. Não exclua arquivos não fornecidos sem verificar sua função.
2. Envie (commit/push) as mudanças para a branch de produção.
3. Na Vercel, confira Settings > Build and Deployment: Vite, npm run build, dist; Root Directory deve apontar para a pasta com package.json.
4. Em Deployments, confira o novo deploy de produção e abra https://exportacao-rj.vercel.app/.

## Teste local
npm install
npm run dev
npm run build

## Banco de dados
A conexão Supabase e o login originais foram preservados. Não é necessário recriar tabelas nem apagar dados. Confirme que as políticas RLS de processos, arquivos e Storage restringem acesso a usuários autorizados. A chave anon original é pública por design, mas não substitui RLS. Não publique dados comerciais de SEED em repositório público; o código original inclui esses dados, que também ficam no bundle do navegador. Revise/remova esses dados do código antes de uma publicação pública, migrando-os com segurança se necessário.

Validação realizada: transpilação sintática TSX. Build completo e acesso ao endereço não confirmados devido à falta de rede e dependências instaladas neste ambiente.
