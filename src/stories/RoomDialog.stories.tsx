import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

import { Center } from '../components/welcome-screen/WelcomeScreen.Center'

export default {
  title: 'Room/Dialog',
  component: Center,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'fullscreen',
  },
} as ComponentMeta<typeof Center>;

const Template: ComponentStory<typeof Center> = (args) => <Center {...args} />;

export const LoggedIn = Template.bind({});
LoggedIn.args = {
  snapshot: {
    tag: 'mSAlaZ5+5U[B5]dIr',
  },
};

export const LoggedOut = Template.bind({});
LoggedOut.args = {};
