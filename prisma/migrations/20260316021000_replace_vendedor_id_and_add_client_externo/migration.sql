-- Add new external client id column on orders
ALTER TABLE `platform_order`
  ADD COLUMN `id_client_externo` VARCHAR(100) NULL;

-- Remove old relation by internal vendor id from orders
ALTER TABLE `platform_order`
  DROP FOREIGN KEY `platform_order_vendedor_id_fkey`;

ALTER TABLE `platform_order`
  DROP COLUMN `vendedor_id`;
