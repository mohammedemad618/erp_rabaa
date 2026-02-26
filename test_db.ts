import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const txs = await prisma.salesTransaction.findMany({ where: { id: { startsWith: 'TRVTX' } } });
    console.log(JSON.stringify(txs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
