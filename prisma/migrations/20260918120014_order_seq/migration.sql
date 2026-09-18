-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "seq" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Order_seq_key" ON "Order"("seq");
