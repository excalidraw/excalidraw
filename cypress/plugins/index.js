module.exports = (on, config) => {
  on(`before:browser:launch`, (browser = {}, args) => {
    if (browser.name === `chrome`) {
      return args.concat(`--auto-open-devtools-for-tabs`);
    }
  });
};
