import * as jspdfModule from 'jspdf';
import { exportToPdf } from '../data/pdf';

global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

describe('exportToPdf', () => {
  it('should export the canvas to a PDF', async () => {
    const mockOutput = jest.fn();
    const mockAddImage = jest.fn();

    const spy = jest.spyOn(jspdfModule, 'jsPDF').mockImplementation((): any => ({
      output: mockOutput,
      addImage: mockAddImage,
    }));

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    await exportToPdf(canvas);

    expect(spy).toHaveBeenCalledWith({
      orientation: 'l',
      unit: 'px',
      format: [canvas.width, canvas.height],
    });
    expect(mockOutput).toHaveBeenCalledWith('blob');
    expect(mockAddImage).toHaveBeenCalled();
  });
});