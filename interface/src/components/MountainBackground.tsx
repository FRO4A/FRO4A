import { useTheme } from '../theme/ThemeProvider';

/**
 * Full-viewport alpine backdrop.
 *
 * Two locally bundled SVG ridges crossfade with the theme. The layer is purely
 * decorative (`pointer-events-none`, `aria-hidden`) and sits behind every glass
 * surface, so the entire UI floats above one continuous mountain landscape with
 * zero external network requests.
 */
export function MountainBackground(): JSX.Element {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  // `BASE_URL` is `./` in production builds, so backdrops keep working on any
  // GitHub Pages repository subpath instead of resolving from the domain root.
  const asset = (name: string): string => `${import.meta.env.BASE_URL}${name}`;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <img
        src={asset('alpine-light.svg')}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500 ${
          dark ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <img
        src={asset('alpine-dark.svg')}
        alt=""
        draggable={false}
        className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500 ${
          dark ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: dark
            ? 'linear-gradient(180deg, rgba(4, 6, 9, 0.34) 0%, rgba(4, 6, 9, 0.06) 42%, rgba(4, 6, 9, 0.4) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 46%, rgba(224, 231, 239, 0.34) 100%)',
        }}
      />
    </div>
  );
}
