import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'VESP Cloud',
  description: 'Documentation for the VESP Cloud Home Assistant display editor',
  cleanUrls: true,
  vite: {
    publicDir: '../assets/imgs'
  },
  themeConfig: {
    logo: '/logo-256x256.jpg',
    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Concepts', link: '/concepts/' },
      { text: 'Widgets', link: '/widgets/' },
      { text: 'Reference', link: '/reference/' },
    ],
    sidebar: {
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/getting-started/' },
            { text: 'Supported Hardware', link: '/getting-started/hardware' },
            { text: 'Home Assistant entities', link: '/getting-started/home-assistant' },
            { text: 'Create a project', link: '/getting-started/create-project' },
            { text: 'Build and install', link: '/getting-started/build' },
            { text: 'Configure Wi-Fi', link: '/getting-started/captive-portal' },
            { text: 'Troubleshooting', link: '/getting-started/troubleshooting' }
          ]
        }
      ],
      '/concepts/': [
        {
          text: 'Project Concepts',
          items: [
            { text: 'Overview', link: '/concepts/' },
            { text: 'Projects', link: '/concepts/#projects' },
            { text: 'Dashboard pages', link: '/concepts/#dashboard-pages' },
            { text: 'Detail views', link: '/concepts/#detail-views' },
            { text: 'Widgets', link: '/concepts/#widgets' },
            { text: 'Containers', link: '/concepts/#containers' },
            { text: 'Home Assistant connections', link: '/concepts/#home-assistant-connections' },
            { text: 'Actions and navigation', link: '/concepts/#actions-and-navigation' },
            { text: 'Notification overlay', link: '/concepts/#notification-overlay' },
            { text: 'Credits & Pricing', link: '/concepts/credits' },
            { text: 'Privacy & Data', link: '/concepts/privacy' },
            { text: 'Themes', link: '/concepts/themes' }
          ]
        }
      ],
      '/widgets/': [
        {
          text: 'Widgets',
          items: [
            { text: 'Overview', link: '/widgets/' },
            { text: 'Text', link: '/widgets/#text' },
            { text: 'Digital clock', link: '/widgets/#digital-clock' },
            { text: 'Button', link: '/widgets/#button' },
            { text: 'Icon', link: '/widgets/#icon' },
            { text: 'Rectangle', link: '/widgets/#rectangle' },
            { text: 'Light', link: '/widgets/#light' },
            { text: 'HVAC', link: '/widgets/#hvac' },
            { text: 'Weather', link: '/widgets/#weather' },
            { text: 'Calendar', link: '/widgets/#calendar' },
            { text: 'Image', link: '/widgets/#image' },
            { text: 'To-do list', link: '/widgets/#to-do-list' },
            { text: 'Tabs', link: '/widgets/#tabs' },
            { text: 'Conditional area', link: '/widgets/#conditional-area' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'Project Settings', link: '/reference/project-settings' },
            { text: 'Notification Overlay', link: '/reference/notification-overlay' },
            { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
            { text: 'Limitations', link: '/reference/limitations' }
          ]
        }
      ]
    },
    search: {
      provider: 'local'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/poesterlin/vesp-cloud' }
    ],
    footer: {
      message: 'Built with VitePress.'
    }
  }
})
