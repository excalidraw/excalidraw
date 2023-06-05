import { ColorPaletteCustom } from '../../colors';
import { getColorNameAndShadeFromColor } from './colorPickerUtils';

test('getColorNameAndShadeFromColor returns null when no matching color is found', () => {
    // Arrange
    const palette: ColorPaletteCustom = {
      green: '#00FF00',
      orange: '#E07C24',
    };
    const color = '#FF6666';
  
    // Act
    const result = getColorNameAndShadeFromColor({ palette, color });
  
    // Assert
    expect(result).toBeNull();
});  