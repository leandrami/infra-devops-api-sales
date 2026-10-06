import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255 })
  eventId: string;

  @Column({ type: "varchar", length: 255 })
  userId: string;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "varchar", length: 50, default: "confirmed" })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
