import polyfill from '../polyfill';

describe('Array.prototype.at polyfill', () => {
  let originalArrayAt: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalArrayAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at');
  });

  afterEach(() => {
    if (originalArrayAt) {
      Object.defineProperty(Array.prototype, 'at', originalArrayAt);
    } else {
      delete (Array.prototype as any).at;
    }
  });

  // CT1: Array.at inexistente
  test('CT1: Should add Array.prototype.at if it does not exist', () => {
    delete (Array.prototype as any).at;
    polyfill();
    expect(Array.prototype.at).toBeInstanceOf(Function);
  });

  // CT2: Array.at existente
  test('CT2: Should do nothing if Array.prototype.at already exists', () => {
    const mockAt = () => 'mocked';
    Object.defineProperty(Array.prototype, 'at', {
      value: mockAt,
      configurable: true,
    });

    polyfill();
    expect((Array.prototype as any).at).toBe(mockAt); 
  });

  describe('Array.prototype.at functionality', () => {
    let arr: number[];

    beforeEach(() => {
      delete (Array.prototype as any).at;
      polyfill();
      arr = [10, 20, 30];
    });

    // CT3: n negativo
    test('CT3: Should return the correct element for a negative index (e.g., -1)', () => {
      // n = -1, this.length = 3
      expect(arr.at(-1)).toBe(30);
    });

    // CT4: n maior ou igual que length
    test('CT4: Should return undefined for an index greater than or equal to length (e.g., 3)', () => {
      // n = 3, this.length = 3
      expect(arr.at(3)).toBeUndefined();
    });

    // CT5: n positivo menor que length
    test('CT5: Should return the correct element for a positive index less than length (e.g., 1)', () => {
      // n = 1, this.length = 3
      expect(arr.at(1)).toBe(20);
    });

    test('Should return the correct element for n = 0', () => {
      expect(arr.at(0)).toBe(10);
    });

    test('Should return undefined for a very large positive index', () => {
      expect(arr.at(999)).toBeUndefined();
    });

    test('Should return undefined for a very large negative index', () => {
      expect(arr.at(-999)).toBeUndefined();
    });

    test('Should handle non-integer n by truncating it', () => {
      expect(arr.at(1.5)).toBe(20);
      expect(arr.at(-0.5)).toBe(10);
    });

    test('Should handle an empty array correctly', () => {
      const emptyArr: number[] = [];
      expect(emptyArr.at(0)).toBeUndefined();
      expect(emptyArr.at(-1)).toBeUndefined();
    });
  });
});

describe('Element.prototype.replaceChildren polyfill', () => {
  let originalReplaceChildren: PropertyDescriptor | undefined;
  let div: HTMLElement;

  beforeAll(() => {
    originalReplaceChildren = Object.getOwnPropertyDescriptor(Element.prototype, 'replaceChildren');
  });

  beforeEach(() => {
    div = document.createElement('div');
    document.body.appendChild(div);
  });

  afterEach(() => {
    document.body.removeChild(div);
    if (originalReplaceChildren) {
      Object.defineProperty(Element.prototype, 'replaceChildren', originalReplaceChildren);
    } else {
      delete (Element.prototype as any).replaceChildren;
    }
  });

  // CT6: replaceChildren inexistente
  test('CT6: Should add Element.prototype.replaceChildren if it does not exist', () => {
    delete (Element.prototype as any).replaceChildren;
    polyfill();
    expect(Element.prototype.replaceChildren).toBeInstanceOf(Function);
  });

  // CT7: replaceChildren existente
  test('CT7: Should do nothing if Element.prototype.replaceChildren already exists', () => {
    const mockReplaceChildren = () => 'mocked';
    Object.defineProperty(Element.prototype, 'replaceChildren', {
      value: mockReplaceChildren,
      configurable: true,
    });

    polyfill();
    expect((Element.prototype as any).replaceChildren).toBe(mockReplaceChildren);
  });

  describe('Element.prototype.replaceChildren functionality', () => {
    beforeEach(() => {
      delete (Element.prototype as any).replaceChildren;
      polyfill();
    });

    test('Should replace existing children with new nodes', () => {
      const child1 = document.createElement('span');
      child1.textContent = 'Old Child 1';
      const child2 = document.createElement('p');
      child2.textContent = 'Old Child 2';
      div.appendChild(child1);
      div.appendChild(child2);

      const newChild1 = document.createElement('a');
      newChild1.textContent = 'New Child 1';
      const newChild2 = document.createElement('strong');
      newChild2.textContent = 'New Child 2';

      div.replaceChildren(newChild1, newChild2);

      expect(div.children.length).toBe(2);
      expect(div.children[0]).toBe(newChild1);
      expect(div.children[1]).toBe(newChild2);
      expect(div.textContent).toBe('New Child 1New Child 2');
    });

    test('Should remove all children if no new nodes are provided', () => {
      const child1 = document.createElement('span');
      const child2 = document.createElement('p');
      div.appendChild(child1);
      div.appendChild(child2);

      div.replaceChildren();

      expect(div.children.length).toBe(0);
      expect(div.innerHTML).toBe('');
    });

    test('Should add children to an empty element', () => {
      expect(div.children.length).toBe(0);

      const newChild = document.createElement('em');
      newChild.textContent = 'Only Child';

      div.replaceChildren(newChild);

      expect(div.children.length).toBe(1);
      expect(div.children[0]).toBe(newChild);
      expect(div.textContent).toBe('Only Child');
    });

    test('Should handle text nodes as arguments', () => {
      const textNode1 = document.createTextNode('Hello');
      const textNode2 = document.createTextNode('World');
      div.replaceChildren(textNode1, textNode2);

      expect(div.childNodes.length).toBe(2);
      expect(div.childNodes[0]).toBe(textNode1);
      expect(div.childNodes[1]).toBe(textNode2);
      expect(div.textContent).toBe('HelloWorld');
    });

    test('Should replace children with a mix of element and text nodes', () => {
      const oldChild = document.createElement('span');
      oldChild.textContent = 'Old';
      div.appendChild(oldChild);

      const newText = document.createTextNode('Text');
      const newElement = document.createElement('b');
      newElement.textContent = 'Bold';

      div.replaceChildren(newText, newElement);

      expect(div.childNodes.length).toBe(2);
      expect(div.childNodes[0]).toBe(newText);
      expect(div.childNodes[1]).toBe(newElement);
      expect(div.textContent).toBe('TextBold');
    });
  });
});