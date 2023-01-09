Earlier we were using `renderFooter` prop to render custom footer which was removed in [#5970](https://github.com/excalidraw/excalidraw/pull/5970). Now you can pass a `Footer` component instead to render the custom UI for footer.

You will need to import the `Footer` component from the package and wrap your component with the Footer component. The `Footer` should a valid React Node.

**Usage**

```js
import { Footer } from "@excalidraw/excalidraw";

const CustomFooter = () => <button> custom button</button>;
const App = () => {
  return (
    <Excalidraw>
      <Footer>
        <CustomFooter />
      </Footer>
    </Excalidraw>
  );
};
```

This will only for `Desktop` devices.

For `mobile` you will need to render it inside the [MainMenu](#mainmenu). You can use the [`useDevice`](#useDevice) hook to check the type of device, this will be available only inside the `children` of `Excalidraw` component.

```js
import { useDevice, Footer } from "@excalidraw/excalidraw";

const MobileFooter = ({
}) => {
  const device = useDevice();
  if (device.isMobile) {
    return (
      <Footer>
       <button
        className="custom-footer"
        onClick={() => alert("This is custom footer in mobile menu")}
      >
        {" "}
        custom footer{" "}
      </button>
      </Footer>
    );
  }
  return null;

};
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.Item> Item1 </MainMenu.Item>
      <MainMenu.Item> Item 2 </>
      <MobileFooter/>
    </MainMenu>
  </Excalidraw>
}

```

You can visit the[ example](https://ehlz3.csb.app/) for working demo.
