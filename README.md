# Block X Bluster

A fast-paced, arcade-style shooting game built with  Next.js. Destroy falling blocks, collect power-ups, and achieve the highest score possible!

## 🎮 Features

- **Responsive Design**: Play on any device - desktop, tablet, or mobile
- **Touch & Keyboard Controls**: Intuitive controls for all platforms
- **Progressive Web App**: Install on your device and play offline
- **Power-up System**: Collect special items to enhance your abilities:
  - 🔥 Fire Speed: Shoot faster
  - 🔱 Multi-Directional: Fire in three directions
  - ⏱️ Slow Motion: Slow down falling blocks
- **Dynamic Difficulty**: Game becomes progressively challenging
- **Optimized Performance**: Smooth gameplay even on lower-end devices

## 🚀 Live Demo

Try the game: [Block X Bluster Demo](https://block-x-bluster.vercel.app/)

## 🛠️ Technologies Used

- Next.js
- TypeScript
- Tailwind CSS
- Service Workers (for offline functionality)
- Web Audio API

## 📋 Prerequisites

- Node.js 16.x or higher
- npm or yarn

## 🔧 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/taiyebnirjhar/block-x-bluster.git
   cd block-x-bluster
   ```

2. Install dependencies:

```shellscript
npm install
# or
yarn install
```

3. Run the development server:

```shellscript
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to play the game.

## 📱 Offline Capabilities

Block X Bluster is a Progressive Web App (PWA), which means:

- It can be installed on your device's home screen
- It works offline after the first load
- Game assets are cached for faster loading
- High scores are saved locally

To install on your device:

- **On Android**: Click the "Add to Home Screen" prompt or use the browser menu
- **On iOS**: Use Safari's "Add to Home Screen" option in the share menu
- **On Desktop**: Look for the install icon in your browser's address bar

## 🎯 How to Play

1. **Start the Game**: Click the "Start Game" button on the home screen
2. **Move Your Ship**:

3. On mobile: Drag your finger to move
4. On desktop: Use arrow keys or WASD

5. **Shooting**: Your ship automatically fires bullets
6. **Avoid Blocks**: Don't let the falling blocks hit your ship
7. **Destroy Blocks**: Shoot blocks to destroy them and earn points
8. **Collect Power-ups**: Grab special items to enhance your abilities

## 🎨 Customization

### Adding Custom Music

To replace the game's audio:

1. Place your audio files in the `/public/assets/sounds/` directory
2. Update the `AUDIO_FILES` object in `game.tsx` to reference your files:

```javascript
const AUDIO_FILES = {
  gameStart: "/assets/sounds/your-start-sound.mp3",
  bgm: "/assets/sounds/your-background-music.mp3",
  fire: "/assets/sounds/your-fire-sound.mp3",
  hit: "/assets/sounds/your-hit-sound.mp3",
  gameOver: "/assets/sounds/your-game-over-sound.mp3",
};
```

### Changing Game Appearance

To modify the game's appearance:

1. Edit the Tailwind CSS classes in `game.tsx`
2. Adjust the player, bullet, and block styles in the render section

## 🔄 Building for Production

```shellscript
npm run build
# or
yarn build
```

Then, deploy the generated output to your hosting provider of choice.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Sound effects from [source]
- Inspiration from classic arcade games
- Built with [v0.dev](https://v0.dev)

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/taiyebnirjhar/block-x-bluster/issues).

---

Made with ❤️ by Taiyeb nirjhar
