export interface Client {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  drawingCount: number;
}

export interface Drawing {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
