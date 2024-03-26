import { PostHogProvider } from "posthog-js/react";

interface PostHogProviderWrapperProps {
  children: React.ReactNode;
}

const PostHogProviderWrapper: React.FC<PostHogProviderWrapperProps> = ({
  children,
}: PostHogProviderWrapperProps) => {
  const apiKey = import.meta.env.VITE_APP_POSTHOG_KEY;
  const options = {
    api_host: import.meta.env.VITE_APP_POSTHOG_HOST,
    session_recording: {
      recordCrossOriginIframes: true,
    },
  };
  if (!apiKey || !options.api_host) {
    return <>{children}</>;
  }
  return (
    <PostHogProvider apiKey={apiKey} options={options}>
      {children}
    </PostHogProvider>
  );
};

export default PostHogProviderWrapper;
