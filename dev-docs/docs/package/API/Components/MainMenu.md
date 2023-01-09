
By default Excalidraw will render the `MainMenu` with default options. If you want to customise the `MainMenu`, you can pass the `MainMenu` component with the list options. You can visit [codesandbox example](https://ehlz3.csb.app/) for a working demo.

**Usage**

```js
import { MainMenu } from "@excalidraw/excalidraw";
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.Item onSelect={() => window.alert("Item1")}> Item1 </MainMenu.Item>
      <MainMenu.Item onSelect={() => window.alert("Item2")}> Item 2 </>
    </MainMenu>
  </Excalidraw>
}
```

### MainMenu

This is the `MainMenu` component which you need to import to render the menu with custom options.

### MainMenu.Item

To render an item, its recommended to use `MainMenu.Item`.

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `onSelect` | `Function` | Yes | `undefined` | The handler is triggered when the item is selected. |
| `children` | `React.ReactNode` | Yes | `undefined` | The content of the menu item |
| `icon` | `JSX.Element` | No | `undefined` | The icon used in the menu item |
| `shortcut` | `string` | No | `undefined` | The shortcut to be shown for the menu item |
| `className` | `string` | No | "" | The class names to be added to the menu item |
| `style` | `React.CSSProperties` | No | `undefined` | The inline styles to be added to the menu item |
| `ariaLabel` | `string` | `undefined` | No | The `aria-label` to be added to the item for accessibility |
| `dataTestId` | `string` | `undefined` | No | The `data-testid` to be added to the item. |

### MainMenu.ItemLink

To render an item as a link, its recommended to use `MainMenu.ItemLink`.

**Usage**

```js
import { MainMenu } from "@excalidraw/excalidraw";
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.ItemLink href="https://google.com">Google</MainMenu.ItemLink>
      <MainMenu.ItemLink href="https://excalidraw.com">
        Excalidraw
      </MainMenu.ItemLink>
    </MainMenu>
  </Excalidraw>;
};
```

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `href` | `string` | Yes | `undefined` | The `href` attribute to be added to the `anchor` element. |
| `children` | `React.ReactNode` | Yes | `undefined` | The content of the menu item |
| `icon` | `JSX.Element` | No | `undefined` | The icon used in the menu item |
| `shortcut` | `string` | No | `undefined` | The shortcut to be shown for the menu item |
| `className` | `string` | No | "" | The class names to be added to the menu item |
| `style` | `React.CSSProperties` | No | `undefined` | The inline styles to be added to the menu item |
| `ariaLabel` | `string` | No | `undefined` | The `aria-label` to be added to the item for accessibility |
| `dataTestId` | `string` | No | `undefined` | The `data-testid` to be added to the item. |

### MainMenu.ItemCustom

To render a custom item, you can use `MainMenu.ItemCustom`.

**Usage**

```js
import { MainMenu } from "@excalidraw/excalidraw";
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.ItemCustom>
        <button
          style={{ height: "2rem" }}
          onClick={() => window.alert("custom menu item")}
        >
          {" "}
          custom item
        </button>
      </MainMenu.ItemCustom>
    </MainMenu>
  </Excalidraw>;
};
```

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `children` | `React.ReactNode` | Yes | `undefined` | The content of the menu item |
| `className` | `string` | No | "" | The class names to be added to the menu item |
| `style` | `React.CSSProperties` | No | `undefined` | The inline styles to be added to the menu item |
| `dataTestId` | `string` | No | `undefined` | The `data-testid` to be added to the item. |

### MainMenu.DefaultItems

For the items which are shown in the menu in [excalidraw.com](https://excalidraw.com), you can use `MainMenu.DefaultItems`

```js
import { MainMenu } from "@excalidraw/excalidraw";
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.DefaultItems.Socials/>
      <MainMenu.DefaultItems.Export/>
      <MainMenu.Item onSelect={() => window.alert("Item1")}> Item1 </MainMenu.Item>
      <MainMenu.Item onSelect={() => window.alert("Item2")}> Item 2 </>
    </MainMenu>
  </Excalidraw>
}
```

Here is a [complete list](https://github.com/excalidraw/excalidraw/blob/master/src/components/mainMenu/DefaultItems.tsx) of the default items.

### MainMenu.Group

To Group item in the main menu, you can use `MainMenu.Group`

```js
import { MainMenu } from "@excalidraw/excalidraw";
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.Group title="Excalidraw items">
        <MainMenu.DefaultItems.Socials/>
        <MainMenu.DefaultItems.Export/>
      </MainMenu.Group>
      <MainMenu.Group title="custom items">
        <MainMenu.Item onSelect={() => window.alert("Item1")}> Item1 </MainMenu.Item>
        <MainMenu.Item onSelect={() => window.alert("Item2")}> Item 2 </>
      </MainMenu.Group>
    </MainMenu>
  </Excalidraw>
}
```

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `children ` | `React.ReactNode` | Yes | `undefined` | The content of the `Menu Group` |
| `title` | `string` | No | `undefined` | The `title` for the grouped items |
| `className` | `string` | No | "" | The `classname` to be added to the group |
| `style` | `React.CSsSProperties` | No | `undefined` | The inline `styles` to be added to the group |