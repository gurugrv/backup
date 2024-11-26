const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'BackYup',
    executableName: 'backyup',
    asar: true,
    icon: path.join(__dirname, 'assets', 'icon'),
    extraResource: [
      // Include the entire bin directory
      path.join(__dirname, 'bin')
    ],
    protocols: [
      {
        name: 'BackYup',
        schemes: ['backyup']
      }
    ],
    osxSign: {
      identity: 'Developer ID Application: Your Name (XXXXXXXXXX)',
      'hardened-runtime': true,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
      'signature-flags': 'library'
    },
    win32metadata: {
      CompanyName: 'Your Company',
      FileDescription: 'BackYup - Desktop Backup Application',
      OriginalFilename: 'backyup.exe',
      ProductName: 'BackYup',
      InternalName: 'backyup'
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'BackYup',
        authors: 'Your Name',
        exe: 'backyup.exe',
        setupExe: 'BackYup-Setup.exe',
        setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
        iconUrl: 'https://raw.githubusercontent.com/yourusername/backyup/main/assets/icon.ico',
        loadingGif: path.join(__dirname, 'assets', 'installing.gif'),
        noMsi: true
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: path.join(__dirname, 'assets', 'icon.png'),
          categories: ['Utility'],
          description: 'Desktop backup application using Kopia',
          genericName: 'Backup Utility',
          maintainer: 'Your Name <your.email@example.com>',
          homepage: 'https://your-website.com',
          name: 'backyup'
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: path.join(__dirname, 'assets', 'icon.png'),
          categories: ['Utility'],
          description: 'Desktop backup application using Kopia',
          genericName: 'Backup Utility',
          maintainer: 'Your Name <your.email@example.com>',
          homepage: 'https://your-website.com',
          name: 'backyup'
        }
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: path.join(__dirname, 'assets', 'icon.icns'),
        background: path.join(__dirname, 'assets', 'dmg-background.png'),
        format: 'ULFO'
      }
    }
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'your-github-username',
          name: 'backyup'
        },
        prerelease: false,
        draft: true
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ],
  hooks: {
    generateAssets: async () => {
      // Add any pre-packaging tasks here
    },
    postPackage: async () => {
      // Add any post-packaging tasks here
    },
    postMake: async () => {
      // Add any post-make tasks here
    }
  }
};
