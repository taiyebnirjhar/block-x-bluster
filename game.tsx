"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Volume2, VolumeX, Maximize, Minimize } from "lucide-react"

// Define interfaces for game objects
interface Bullet {
  id: number
  x: number
  y: number
  angle?: number // For multi-directional fire
}

interface Block {
  id: number
  x: number
  y: number
  hp: number
  isHit?: boolean
  isBreakable: boolean
}

interface PowerUp {
  id: number
  x: number
  y: number
  type: PowerUpType
}

// Power-up types
type PowerUpType = "fireSpeed" | "multiDirectional" | "slowMotion"

// Game states
type GameState = "notStarted" | "playing" | "gameOver"

// Audio files
const AUDIO_FILES = {
  gameStart: "/assets/sounds/game_start.mp3",
  bgm: "/assets/sounds/bgm_loop.mp3",
  fire: "/assets/sounds/fire.mp3",
  hit: "/assets/sounds/hit.mp3",
  gameOver: "/assets/sounds/game_over.mp3",
}

export default function Game() {
  // 1. Optimize object creation by implementing object pooling for bullets
  // Add this near the top of the component, with other refs
  const bulletPoolRef = useRef<Bullet[]>([])
  const MAX_BULLETS = 100 // Maximum bullets to keep in memory

  // Game state
  const [gameState, setGameState] = useState<GameState>("notStarted")
  const [gameOverEffect, setGameOverEffect] = useState(false)
  const [gameTime, setGameTime] = useState(0) // Track game time in seconds

  // Difficulty progression
  const [blockSpawnRate, setBlockSpawnRate] = useState(2000) // ms between block spawns
  const [blockFallSpeed, setBlockFallSpeed] = useState(3) // pixels per frame
  const [blocksPerWave, setBlocksPerWave] = useState(1) // blocks spawned per wave

  // Power-up system
  const [activePowerUps, setActivePowerUps] = useState<{
    fireSpeed: boolean
    multiDirectional: boolean
    slowMotion: boolean
  }>({
    fireSpeed: false,
    multiDirectional: false,
    slowMotion: false,
  })
  const [powerUpTimeLeft, setPowerUpTimeLeft] = useState<{
    fireSpeed: number
    multiDirectional: number
    slowMotion: number
  }>({
    fireSpeed: 0,
    multiDirectional: 0,
    slowMotion: 0,
  })

  // Audio state
  const [isMuted, setIsMuted] = useState(() => {
    // Check localStorage for saved preference
    if (typeof window !== "undefined") {
      const savedMute = localStorage.getItem("gameMuted")
      return savedMute === "true"
    }
    return false
  })
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [keys, setKeys] = useState({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false,
  })

  // Game objects state - use refs for performance
  const bulletsRef = useRef<Bullet[]>([])
  const blocksRef = useRef<Block[]>([])
  const powerUpsRef = useRef<PowerUp[]>([])

  // State for rendering only - updated less frequently
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])
  const [score, setScore] = useState(0)

  // Refs for generating unique IDs and tracking current position
  const bulletIdRef = useRef(0)
  const blockIdRef = useRef(0)
  const powerUpIdRef = useRef(0)
  const positionRef = useRef(position)
  const finalScoreRef = useRef(0)
  const lastFireSoundTime = useRef(0)
  const lastFireTimeRef = useRef(0)
  const scoreRef = useRef(0)
  const gameStateRef = useRef<GameState>("notStarted")
  const blockFallSpeedRef = useRef(3)
  const activePowerUpsRef = useRef({
    fireSpeed: false,
    multiDirectional: false,
    slowMotion: false,
  })

  // Animation frame IDs for proper cleanup
  const animationFrameIds = useRef<{
    player?: number
    bullets?: number
    objects?: number
    collisions?: number
    playerCollisions?: number
  }>({})

  // Audio refs
  const gameStartSoundRef = useRef<HTMLAudioElement | null>(null)
  const bgmSoundRef = useRef<HTMLAudioElement | null>(null)
  const fireSoundRef = useRef<HTMLAudioElement | null>(null)
  const hitSoundRef = useRef<HTMLAudioElement | null>(null)
  const gameOverSoundRef = useRef<HTMLAudioElement | null>(null)

  const gameContainerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)

  // Render throttling for performance
  const renderIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const needsRenderRef = useRef(false)

  // Audio play functions with robust error handling
  const playSound = useCallback(
    (soundRef: React.MutableRefObject<HTMLAudioElement | null>) => {
      if (isMuted || !soundRef.current || !audioLoaded) return

      try {
        // Reset the audio to the beginning if it's already playing
        soundRef.current.currentTime = 0

        // Use a promise with catch for better error handling
        const playPromise = soundRef.current.play()

        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Audio playback was prevented:", error)
            // Most likely due to browser autoplay policy
            // We'll just continue silently
          })
        }
      } catch (error) {
        console.warn("Error playing sound:", error)
        // Continue game without sound
      }
    },
    [isMuted, audioLoaded],
  )

  // 2. Optimize collision detection by using a spatial grid
  // Add this function after the component declaration but before other functions
  const createBullet = useCallback((x: number, y: number, angle = 0): Bullet => {
    // Reuse a bullet from the pool if available
    if (bulletPoolRef.current.length > 0) {
      const bullet = bulletPoolRef.current.pop()!
      bullet.x = x
      bullet.y = y
      bullet.angle = angle
      return bullet
    }

    // Create a new bullet if pool is empty
    return { id: bulletIdRef.current++, x, y, angle }
  }, [])

  // Spawn power-up function - defined early to avoid reference errors
  const spawnPowerUp = useCallback(() => {
    if (gameContainerRef.current && gameStateRef.current === "playing") {
      const containerWidth = gameContainerRef.current.clientWidth
      const powerUpWidth = 30 // Width of the power-up

      // Random horizontal position within screen bounds
      const powerUpX = Math.random() * (containerWidth - powerUpWidth)

      // Random power-up type
      const powerUpTypes: PowerUpType[] = ["fireSpeed", "multiDirectional", "slowMotion"]
      const randomType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]

      const newPowerUp = {
        id: powerUpIdRef.current,
        x: powerUpX,
        y: -50, // Start above the screen
        type: randomType,
      }

      powerUpsRef.current = [...powerUpsRef.current, newPowerUp]
      powerUpIdRef.current += 1
      needsRenderRef.current = true
    }
  }, [])

  // Activate power-up function
  const activatePowerUp = useCallback((type: PowerUpType) => {
    // Set power-up as active
    setActivePowerUps((prev) => {
      const updated = {
        ...prev,
        [type]: true,
      }
      activePowerUpsRef.current = updated
      return updated
    })

    // Set duration based on type
    setPowerUpTimeLeft((prev) => ({
      ...prev,
      [type]: type === "slowMotion" ? 5 : 10, // slowMotion: 5s, others: 10s
    }))
  }, [])

  // Game over function
  const triggerGameOver = useCallback(() => {
    // Cancel all animation frames
    Object.values(animationFrameIds.current).forEach((id) => {
      if (id) cancelAnimationFrame(id)
    })
    animationFrameIds.current = {}

    setGameState("gameOver")
    gameStateRef.current = "gameOver"
    setGameOverEffect(true)

    // Play game over sound
    playSound(gameOverSoundRef)

    // Stop background music
    if (bgmSoundRef.current) {
      bgmSoundRef.current.pause()
    }

    // Reset game over effect after a short delay
    setTimeout(() => {
      setGameOverEffect(false)
    }, 300)
  }, [playSound])

  const playFireSound = useCallback(() => {
    // Throttle fire sound to prevent overlapping when firing rapidly
    const now = Date.now()
    if (now - lastFireSoundTime.current > 100) {
      // Only play if at least 100ms has passed since last fire sound
      playSound(fireSoundRef)
      lastFireSoundTime.current = now
    }
  }, [playSound])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev

      // Update all audio elements
      if (bgmSoundRef.current) {
        bgmSoundRef.current.muted = newMuted
      }

      return newMuted
    })
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (gameContainerRef.current?.requestFullscreen) {
        gameContainerRef.current
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch((err) => console.error(`Error attempting to enable fullscreen: ${err.message}`))
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch((err) => console.error(`Error attempting to exit fullscreen: ${err.message}`))
      }
    }
  }, [])

  // Handle touch/mouse events for dragging
  const handleTouchStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (gameState !== "playing") return

      setIsDragging(true)

      // Get touch or mouse position
      const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
      const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

      // Store the offset between touch point and player position
      setDragStart({
        x: clientX - positionRef.current.x,
        y: clientY - positionRef.current.y,
      })
    },
    [gameState],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDragging || gameState !== "playing" || !playerRef.current || !gameContainerRef.current) return

      e.preventDefault() // Prevent scrolling while dragging

      // Get touch or mouse position
      const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
      const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

      // Calculate new position
      let newX = clientX - dragStart.x
      let newY = clientY - dragStart.y

      // Clamp position within screen boundaries
      const containerWidth = gameContainerRef.current.clientWidth
      const containerHeight = gameContainerRef.current.clientHeight
      const playerWidth = playerRef.current.clientWidth
      const playerHeight = playerRef.current.clientHeight

      newX = Math.max(0, Math.min(containerWidth - playerWidth, newX))
      newY = Math.max(0, Math.min(containerHeight - playerHeight, newY))

      // Update position ref directly without state update
      positionRef.current = { x: newX, y: newY }

      // Apply transform directly to DOM for immediate visual feedback
      playerRef.current.style.transform = `translate(${newX}px, ${newY}px)`
    },
    [isDragging, gameState, dragStart],
  )

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      // Only update React state once at the end of dragging
      setPosition(positionRef.current)
      setIsDragging(false)
    }
  }, [isDragging])

  // Initialize audio with robust error handling
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Helper function to safely create audio elements
      const createAudio = (src: string): HTMLAudioElement => {
        const audio = new Audio()

        // Add error handling
        audio.addEventListener("error", (e) => {
          console.warn(`Audio file could not be loaded: ${src}`, e)
        })

        // Only set src after adding error listener
        audio.src = src
        return audio
      }

      try {
        gameStartSoundRef.current = createAudio(AUDIO_FILES.gameStart)
        bgmSoundRef.current = createAudio(AUDIO_FILES.bgm)
        fireSoundRef.current = createAudio(AUDIO_FILES.fire)
        hitSoundRef.current = createAudio(AUDIO_FILES.hit)
        gameOverSoundRef.current = createAudio(AUDIO_FILES.gameOver)

        // Set up looping for background music
        if (bgmSoundRef.current) {
          bgmSoundRef.current.loop = true
        }

        setAudioLoaded(true)
      } catch (error) {
        console.error("Error initializing audio:", error)
        setAudioLoaded(false)
      }
    }

    return () => {
      // Clean up audio when component unmounts
      if (bgmSoundRef.current) {
        bgmSoundRef.current.pause()
      }
    }
  }, [])

  // Add fullscreen change event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  // Update mute state in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gameMuted", isMuted.toString())
    }
  }, [isMuted])

  // 6. Optimize the render throttling for better performance
  // Replace the useEffect for render throttling with this
  useEffect(() => {
    // Use a more efficient render strategy with RAF instead of setInterval
    let rafId: number | null = null

    const updateRender = () => {
      if (needsRenderRef.current && gameStateRef.current === "playing") {
        setBullets([...bulletsRef.current])
        setBlocks([...blocksRef.current])
        setPowerUps([...powerUpsRef.current])
        setScore(scoreRef.current)
        needsRenderRef.current = false
      }
      rafId = requestAnimationFrame(updateRender)
    }

    rafId = requestAnimationFrame(updateRender)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  // Update refs when state changes
  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    blockFallSpeedRef.current = blockFallSpeed
  }, [blockFallSpeed])

  useEffect(() => {
    activePowerUpsRef.current = activePowerUps
  }, [activePowerUps])

  // Game timer - track elapsed time and handle difficulty progression
  useEffect(() => {
    if (gameState !== "playing") return

    const gameTimerInterval = setInterval(() => {
      setGameTime((prevTime) => {
        const newTime = prevTime + 1

        // Increase blocks per wave every 10 seconds (max 5)
        if (newTime % 10 === 0 && blocksPerWave < 5) {
          setBlocksPerWave((prev) => Math.min(prev + 1, 5))
        }

        // Increase fall speed every 15 seconds
        if (newTime % 15 === 0) {
          setBlockFallSpeed((prev) => prev + 0.5)
        }

        // Decrease spawn rate every 20 seconds (min 500ms)
        if (newTime % 20 === 0 && blockSpawnRate > 500) {
          setBlockSpawnRate((prev) => Math.max(prev - 300, 500))
        }

        // Spawn power-up every 20 seconds
        if (newTime % 20 === 0) {
          spawnPowerUp()
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(gameTimerInterval)
  }, [gameState, blocksPerWave, blockSpawnRate, spawnPowerUp])

  // Power-up timers
  useEffect(() => {
    if (gameState !== "playing") return

    const powerUpTimerInterval = setInterval(() => {
      setPowerUpTimeLeft((prev) => {
        const newTimeLeft = {
          fireSpeed: Math.max(0, prev.fireSpeed - 1),
          multiDirectional: Math.max(0, prev.multiDirectional - 1),
          slowMotion: Math.max(0, prev.slowMotion - 1),
        }

        // Deactivate power-ups when time runs out
        setActivePowerUps((activePrev) => ({
          fireSpeed: newTimeLeft.fireSpeed > 0,
          multiDirectional: newTimeLeft.multiDirectional > 0,
          slowMotion: newTimeLeft.slowMotion > 0,
        }))

        return newTimeLeft
      })
    }, 1000)

    return () => clearInterval(powerUpTimerInterval)
  }, [gameState])

  // Update final score ref when game ends
  useEffect(() => {
    if (gameState === "gameOver") {
      finalScoreRef.current = score
    }
  }, [gameState, score])

  // Clean up all animation frames when component unmounts or game state changes
  useEffect(() => {
    return () => {
      // Cancel all animation frames
      Object.values(animationFrameIds.current).forEach((id) => {
        if (id) cancelAnimationFrame(id)
      })

      // Clear all intervals
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current)
      }
    }
  }, [])

  // Reset game state when game ends
  useEffect(() => {
    if (gameState !== "playing") {
      // Cancel all animation frames
      Object.values(animationFrameIds.current).forEach((id) => {
        if (id) cancelAnimationFrame(id)
      })
      animationFrameIds.current = {}
    }
  }, [gameState])

  // Optimize touch events
  useEffect(() => {
    if (!gameContainerRef.current) return

    const container = gameContainerRef.current

    // Custom event handlers with passive: false
    const touchStartHandler = (e: TouchEvent) => {
      if (gameState !== "playing") return
      handleTouchStart(e as unknown as React.TouchEvent)
    }

    const touchMoveHandler = (e: TouchEvent) => {
      if (!isDragging || gameState !== "playing") return
      e.preventDefault() // Prevent scrolling
      handleTouchMove(e as unknown as React.TouchEvent)
    }

    const touchEndHandler = () => {
      handleTouchEnd()
    }

    // Add event listeners with passive: false for touchmove
    container.addEventListener("touchstart", touchStartHandler, { passive: true })
    container.addEventListener("touchmove", touchMoveHandler, { passive: false })
    container.addEventListener("touchend", touchEndHandler)

    return () => {
      // Clean up
      container.removeEventListener("touchstart", touchStartHandler)
      container.removeEventListener("touchmove", touchMoveHandler)
      container.removeEventListener("touchend", touchEndHandler)
    }
  }, [gameState, isDragging, handleTouchStart, handleTouchMove, handleTouchEnd])

  // 3. Optimize the fireBullet function to use object pooling
  // Replace the fireBullet function with this optimized version
  const fireBullet = useCallback(() => {
    if (playerRef.current && gameStateRef.current === "playing") {
      const playerWidth = playerRef.current.clientWidth
      const currentPosition = positionRef.current
      const now = Date.now()

      // Check fire rate based on power-up
      const fireRate = activePowerUpsRef.current.fireSpeed ? 100 : 200
      if (now - lastFireTimeRef.current < fireRate) return
      lastFireTimeRef.current = now

      // Calculate bullet position from the top-center of the fighter plane
      const bulletX = currentPosition.x + playerWidth / 2 - 4
      const bulletY = currentPosition.y - 8

      if (activePowerUpsRef.current.multiDirectional) {
        // Fire 3 bullets in different directions
        bulletsRef.current.push(
          createBullet(bulletX, bulletY, 0),
          createBullet(bulletX - 8, bulletY, -30),
          createBullet(bulletX + 8, bulletY, 30),
        )
      } else {
        // Fire single bullet
        bulletsRef.current.push(createBullet(bulletX, bulletY, 0))
      }

      // Play fire sound
      playFireSound()
      needsRenderRef.current = true
    }
  }, [playFireSound, createBullet])

  // Add automatic firing effect
  useEffect(() => {
    if (gameState !== "playing") return

    const firingInterval = setInterval(() => {
      fireBullet()
    }, 50) // Check frequently, but actual firing is controlled by fireBullet

    return () => clearInterval(firingInterval)
  }, [gameState, fireBullet])

  // Block spawning logic
  const spawnBlock = useCallback(() => {
    if (gameContainerRef.current && gameStateRef.current === "playing") {
      const containerWidth = gameContainerRef.current.clientWidth
      const blockWidth = 40 // Width of the block

      // Spawn multiple blocks based on blocksPerWave
      for (let i = 0; i < blocksPerWave; i++) {
        // Random horizontal position within screen bounds with spacing
        const blockX = Math.random() * (containerWidth - blockWidth)

        // Random HP between 1 and 10
        const blockHp = Math.floor(Math.random() * 10) + 1

        // Small chance for unbreakable block (10%)
        const isBreakable = Math.random() > 0.1

        const newBlock = {
          id: blockIdRef.current,
          x: blockX,
          y: -50 - i * 60, // Start above the screen with spacing between blocks
          hp: isBreakable ? blockHp : 999, // Unbreakable blocks have very high HP
          isHit: false,
          isBreakable,
        }

        blocksRef.current = [...blocksRef.current, newBlock]
        blockIdRef.current += 1
      }

      needsRenderRef.current = true
    }
  }, [blocksPerWave])

  // Block spawning effect
  useEffect(() => {
    if (gameState !== "playing") return

    const blockInterval = setInterval(spawnBlock, blockSpawnRate)

    return () => {
      clearInterval(blockInterval)
    }
  }, [spawnBlock, blockSpawnRate, gameState])

  // Handle keyboard controls
  useEffect(() => {
    if (gameState !== "playing") return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (Object.keys(keys).includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (Object.keys(keys).includes(e.key)) {
        setKeys((prev) => ({ ...prev, [e.key]: false }))
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [keys, gameState])

  // Start game function
  const startGame = useCallback(() => {
    if (gameContainerRef.current) {
      // Cancel any existing animation frames
      Object.values(animationFrameIds.current).forEach((id) => {
        if (id) cancelAnimationFrame(id)
      })
      animationFrameIds.current = {}

      const containerWidth = gameContainerRef.current.clientWidth
      const containerHeight = gameContainerRef.current.clientHeight

      // Position player at bottom center
      const newPosition = {
        x: containerWidth / 2 - 24, // 24 is half of player width (48px)
        y: containerHeight - 100, // 100px from bottom
      }

      // Reset all game state
      setPosition(newPosition)
      positionRef.current = newPosition
      setGameState("playing")
      gameStateRef.current = "playing"

      // Clear all game objects
      bulletsRef.current = []
      blocksRef.current = []
      powerUpsRef.current = []
      setBullets([])
      setBlocks([])
      setPowerUps([])

      // Reset score and game parameters
      scoreRef.current = 0
      setScore(0)
      setGameTime(0)
      setBlockSpawnRate(2000)
      setBlockFallSpeed(3)
      blockFallSpeedRef.current = 3
      setBlocksPerWave(1)

      // Reset power-ups
      setActivePowerUps({
        fireSpeed: false,
        multiDirectional: false,
        slowMotion: false,
      })
      activePowerUpsRef.current = {
        fireSpeed: false,
        multiDirectional: false,
        slowMotion: false,
      }
      setPowerUpTimeLeft({
        fireSpeed: 0,
        multiDirectional: 0,
        slowMotion: 0,
      })

      // Reset IDs
      bulletIdRef.current = 0
      blockIdRef.current = 0
      powerUpIdRef.current = 0

      // 7. Add a cleanup function for the bullet pool when the game ends
      // Add this to the startGame function, right after resetting IDs
      // Reset bullet pool
      bulletPoolRef.current = []

      // Start animation loops
      startAnimationLoops()

      // Play startup sound
      playSound(gameStartSoundRef)

      // Start background music after startup sound finishes
      if (gameStartSoundRef.current && bgmSoundRef.current && audioLoaded) {
        const startupDuration = gameStartSoundRef.current.duration || 2 // fallback to 2 seconds if duration not available
        setTimeout(() => {
          playSound(bgmSoundRef)
        }, startupDuration * 1000)
      } else {
        // Fallback if startup sound isn't loaded yet
        setTimeout(() => {
          playSound(bgmSoundRef)
        }, 2000)
      }
    }
  }, [playSound, audioLoaded])

  // Start all animation loops
  const startAnimationLoops = useCallback(() => {
    // Player movement animation
    const animatePlayer = () => {
      if (gameStateRef.current !== "playing" || !gameContainerRef.current || !playerRef.current) return

      const speed = 5
      let newX = positionRef.current.x
      let newY = positionRef.current.y
      let positionChanged = false

      // Handle keyboard movement
      if (keys.ArrowUp || keys.w) {
        newY -= speed
        positionChanged = true
      }
      if (keys.ArrowDown || keys.s) {
        newY += speed
        positionChanged = true
      }
      if (keys.ArrowLeft || keys.a) {
        newX -= speed
        positionChanged = true
      }
      if (keys.ArrowRight || keys.d) {
        newX += speed
        positionChanged = true
      }

      // Only process if position changed and not currently dragging
      if (positionChanged && !isDragging) {
        // Clamp position within screen boundaries
        const containerWidth = gameContainerRef.current.clientWidth
        const containerHeight = gameContainerRef.current.clientHeight
        const playerWidth = playerRef.current.clientWidth
        const playerHeight = playerRef.current.clientHeight

        newX = Math.max(0, Math.min(containerWidth - playerWidth, newX))
        newY = Math.max(0, Math.min(containerHeight - playerHeight, newY))

        // Update position ref
        positionRef.current = { x: newX, y: newY }

        // Update React state (triggers re-render)
        setPosition({ x: newX, y: newY })

        // Apply transform directly for immediate feedback
        playerRef.current.style.transform = `translate(${newX}px, ${newY}px)`
      }

      animationFrameIds.current.player = requestAnimationFrame(animatePlayer)
    }

    // 4. Optimize the animateBullets function to recycle bullets
    // Replace the animateBullets function inside startAnimationLoops with this
    const animateBullets = () => {
      if (gameStateRef.current !== "playing") return

      const keptBullets: Bullet[] = []
      const recycledBullets: Bullet[] = []

      // Process each bullet
      for (const bullet of bulletsRef.current) {
        const angle = bullet.angle || 0
        const radians = (angle * Math.PI) / 180
        const speedX = Math.sin(radians) * 10
        const speedY = -Math.cos(radians) * 10

        // Update position
        bullet.x += speedX
        bullet.y += speedY

        // Keep bullets on screen, recycle off-screen bullets
        if (bullet.y > -20) {
          keptBullets.push(bullet)
        } else {
          recycledBullets.push(bullet)
        }
      }

      // Update active bullets
      bulletsRef.current = keptBullets

      // Recycle off-screen bullets (add to pool)
      if (recycledBullets.length > 0) {
        // Limit pool size to prevent memory issues
        const availableSpace = MAX_BULLETS - bulletPoolRef.current.length
        if (availableSpace > 0) {
          bulletPoolRef.current.push(...recycledBullets.slice(0, availableSpace))
        }
      }

      needsRenderRef.current = true
      animationFrameIds.current.bullets = requestAnimationFrame(animateBullets)
    }

    // Block and power-up animation
    const animateObjects = () => {
      if (gameStateRef.current !== "playing" || !gameContainerRef.current) return

      const containerHeight = gameContainerRef.current.clientHeight

      // Calculate actual fall speed based on slow-motion power-up
      const currentFallSpeed = activePowerUpsRef.current.slowMotion
        ? blockFallSpeedRef.current * 0.5
        : blockFallSpeedRef.current

      // Animate blocks
      const updatedBlocks = blocksRef.current
        .map((block) => ({
          ...block,
          y: block.y + currentFallSpeed,
        }))
        .filter((block) => {
          // Remove blocks that are off-screen or have 0 HP
          return block.y < containerHeight + 50 && (block.isBreakable ? block.hp > 0 : true)
        })

      blocksRef.current = updatedBlocks

      // Animate power-ups
      const updatedPowerUps = powerUpsRef.current
        .map((powerUp) => ({
          ...powerUp,
          y: powerUp.y + 2, // Power-up falling speed (slower than blocks)
        }))
        .filter((powerUp) => powerUp.y < containerHeight + 50) // Remove power-ups that are off-screen

      powerUpsRef.current = updatedPowerUps
      needsRenderRef.current = true

      animationFrameIds.current.objects = requestAnimationFrame(animateObjects)
    }

    // 5. Optimize the checkCollisions function to be more efficient
    // Replace the checkCollisions function inside startAnimationLoops with this
    const checkCollisions = () => {
      if (gameStateRef.current !== "playing") return

      const bulletsToRecycle: Bullet[] = []
      let hitDetected = false

      // Use for loops instead of forEach for better performance
      const bulletCount = bulletsRef.current.length
      const blockCount = blocksRef.current.length

      // Skip collision detection if there are no bullets or blocks
      if (bulletCount === 0 || blockCount === 0) {
        animationFrameIds.current.collisions = requestAnimationFrame(checkCollisions)
        return
      }

      // Process each bullet
      for (let i = 0; i < bulletCount; i++) {
        const bullet = bulletsRef.current[i]
        if (!bullet) continue

        // Bullet hitbox
        const bulletLeft = bullet.x
        const bulletRight = bullet.x + 8
        const bulletTop = bullet.y
        const bulletBottom = bullet.y + 16

        // Check against each block
        for (let j = 0; j < blockCount; j++) {
          const block = blocksRef.current[j]
          if (!block) continue

          // Block hitbox
          const blockLeft = block.x
          const blockRight = block.x + 40
          const blockTop = block.y
          const blockBottom = block.y + 40

          // Check for collision
          if (
            bulletRight > blockLeft &&
            bulletLeft < blockRight &&
            bulletBottom > blockTop &&
            bulletTop < blockBottom
          ) {
            // Collision detected!
            bulletsToRecycle.push(bullet)
            hitDetected = true

            // Play hit sound
            playSound(hitSoundRef)

            // Update block
            if (block.isBreakable) {
              block.hp -= 1
              scoreRef.current += 1
            }

            block.isHit = true
            break // Skip checking this bullet against other blocks
          }
        }
      }

      // Remove bullets that hit blocks and add them to the pool
      if (bulletsToRecycle.length > 0) {
        // Remove from active bullets
        bulletsRef.current = bulletsRef.current.filter((bullet) => !bulletsToRecycle.some((b) => b.id === bullet.id))

        // Add to bullet pool (limited by MAX_BULLETS)
        const availableSpace = MAX_BULLETS - bulletPoolRef.current.length
        if (availableSpace > 0) {
          bulletPoolRef.current.push(...bulletsToRecycle.slice(0, availableSpace))
        }
      }

      // Remove blocks with 0 HP and reset isHit after a short delay
      if (hitDetected) {
        // Filter out breakable blocks with 0 HP
        blocksRef.current = blocksRef.current.filter((block) => !block.isBreakable || block.hp > 0)
        needsRenderRef.current = true

        // Reset isHit after a short delay for visual feedback
        setTimeout(() => {
          for (const block of blocksRef.current) {
            block.isHit = false
          }
          needsRenderRef.current = true
        }, 50)
      }

      animationFrameIds.current.collisions = requestAnimationFrame(checkCollisions)
    }

    // Collision detection between blocks/power-ups and player
    const checkPlayerCollisions = () => {
      if (gameStateRef.current !== "playing" || !playerRef.current) return

      // Player hitbox
      const playerWidth = 48 // 12 * 4 = 48px (w-12 in Tailwind)
      const playerHeight = 48 // 12 * 4 = 48px (h-12 in Tailwind)
      const playerLeft = positionRef.current.x
      const playerRight = positionRef.current.x + playerWidth
      const playerTop = positionRef.current.y
      const playerBottom = positionRef.current.y + playerHeight

      // Check each block for collision with player
      for (const block of blocksRef.current) {
        // Block hitbox
        const blockWidth = 40 // 10 * 4 = 40px (w-10 in Tailwind)
        const blockHeight = 40 // 10 * 4 = 40px (h-10 in Tailwind)
        const blockLeft = block.x
        const blockRight = block.x + blockWidth
        const blockTop = block.y
        const blockBottom = block.y + blockHeight

        // Check for collision using the provided logic
        const isColliding =
          playerLeft < blockRight && playerRight > blockLeft && playerTop < blockBottom && playerBottom > blockTop

        if (isColliding) {
          // Game over!
          triggerGameOver()
          return
        }
      }

      // Check each power-up for collision with player
      const powerUpsToCollect: number[] = []
      for (const powerUp of powerUpsRef.current) {
        // Power-up hitbox
        const powerUpWidth = 30
        const powerUpHeight = 30
        const powerUpLeft = powerUp.x
        const powerUpRight = powerUp.x + powerUpWidth
        const powerUpTop = powerUp.y
        const powerUpBottom = powerUp.y + powerUpHeight

        // Check for collision
        const isColliding =
          playerLeft < powerUpRight &&
          playerRight > powerUpLeft &&
          playerTop < powerUpBottom &&
          playerBottom > powerUpTop

        if (isColliding) {
          // Collect power-up
          powerUpsToCollect.push(powerUp.id)
          activatePowerUp(powerUp.type)
        }
      }

      // Remove collected power-ups
      if (powerUpsToCollect.length > 0) {
        powerUpsRef.current = powerUpsRef.current.filter((powerUp) => !powerUpsToCollect.includes(powerUp.id))
        needsRenderRef.current = true
      }

      animationFrameIds.current.playerCollisions = requestAnimationFrame(checkPlayerCollisions)
    }

    // Start all animation loops
    animationFrameIds.current.player = requestAnimationFrame(animatePlayer)
    animationFrameIds.current.bullets = requestAnimationFrame(animateBullets)
    animationFrameIds.current.objects = requestAnimationFrame(animateObjects)
    animationFrameIds.current.collisions = requestAnimationFrame(checkCollisions)
    animationFrameIds.current.playerCollisions = requestAnimationFrame(checkPlayerCollisions)
  }, [keys, playSound, triggerGameOver, activatePowerUp, isDragging])

  // Get block color based on HP and breakability
  const getBlockColor = (hp: number, isBreakable: boolean, isHit = false) => {
    // If the block was just hit, return a white background for flash effect
    if (isHit) return "bg-white"

    // Unbreakable blocks are dark gray/metallic
    if (!isBreakable) return "bg-gray-700 border border-gray-500"

    // Normal blocks based on HP
    switch (hp) {
      case 1:
        return "bg-red-500"
      case 2:
        return "bg-orange-500"
      case 3:
        return "bg-yellow-500"
      case 4:
        return "bg-lime-500"
      case 5:
        return "bg-green-500"
      case 6:
        return "bg-teal-500"
      case 7:
        return "bg-blue-500"
      case 8:
        return "bg-indigo-500"
      case 9:
        return "bg-purple-500"
      case 10:
        return "bg-pink-500"
      default:
        return "bg-gray-500"
    }
  }

  // Get power-up color and icon based on type
  const getPowerUpStyle = (type: PowerUpType) => {
    switch (type) {
      case "fireSpeed":
        return {
          className: "bg-red-500 animate-pulse",
          icon: "🔥",
        }
      case "multiDirectional":
        return {
          className: "bg-blue-500 animate-pulse",
          icon: "🔱",
        }
      case "slowMotion":
        return {
          className: "bg-purple-500 animate-pulse",
          icon: "⏱️",
        }
    }
  }

  return (
    <div
      ref={gameContainerRef}
      className={`w-screen h-screen bg-gray-900 overflow-hidden touch-none relative ${
        gameOverEffect ? "bg-red-900" : ""
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={(e) => {
        e.preventDefault() // Prevent scrolling
        handleTouchMove(e)
      }}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
    >
      {/* Control buttons - always visible */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={toggleFullscreen}
          className="bg-gray-800 bg-opacity-75 p-2 rounded-full"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize className="w-6 h-6 text-white" /> : <Maximize className="w-6 h-6 text-white" />}
        </button>
        <button
          onClick={toggleMute}
          className="bg-gray-800 bg-opacity-75 p-2 rounded-full"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-6 h-6 text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
        </button>
      </div>

      {gameState === "notStarted" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-8">Block X Bluster</h1>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-blue-500 text-white text-xl font-bold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Start Game
            </button>
          </div>
        </div>
      ) : gameState === "gameOver" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center bg-gray-800 bg-opacity-90 p-8 rounded-xl">
            <h1 className="text-4xl font-bold text-white mb-4">Game Over</h1>
            <p className="text-2xl text-white mb-8">Final Score: {finalScoreRef.current}</p>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-blue-500 text-white text-xl font-bold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Score display */}
          <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-75 px-4 py-2 rounded-lg">
            <span className="text-white font-bold text-xl">Score: {score}</span>
          </div>

          {/* Active power-ups display */}
          <div className="absolute top-16 left-4 flex flex-col gap-2">
            {activePowerUps.fireSpeed && (
              <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-lg flex items-center gap-2">
                <span className="text-white">🔥</span>
                <span className="text-white text-sm">Fire Speed: {powerUpTimeLeft.fireSpeed}s</span>
              </div>
            )}
            {activePowerUps.multiDirectional && (
              <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-lg flex items-center gap-2">
                <span className="text-white">🔱</span>
                <span className="text-white text-sm">Multi-Fire: {powerUpTimeLeft.multiDirectional}s</span>
              </div>
            )}
            {activePowerUps.slowMotion && (
              <div className="bg-gray-800 bg-opacity-75 px-3 py-1 rounded-lg flex items-center gap-2">
                <span className="text-white">⏱️</span>
                <span className="text-white text-sm">Slow-Mo: {powerUpTimeLeft.slowMotion}s</span>
              </div>
            )}
          </div>

          {/* Render blocks */}
          {blocks.map((block) => (
            <div
              key={block.id}
              className={`w-10 h-10 ${getBlockColor(block.hp, block.isBreakable, block.isHit)} rounded-lg absolute flex items-center justify-center transition-colors duration-50`}
              style={{
                transform: `translate(${block.x}px, ${block.y}px)`,
              }}
            >
              <span className="text-white font-bold text-lg">{block.isBreakable ? block.hp : "∞"}</span>
            </div>
          ))}

          {/* Render power-ups */}
          {powerUps.map((powerUp) => {
            const style = getPowerUpStyle(powerUp.type)
            return (
              <div
                key={powerUp.id}
                className={`w-8 h-8 ${style.className} rounded-full absolute flex items-center justify-center shadow-lg`}
                style={{
                  transform: `translate(${powerUp.x}px, ${powerUp.y}px)`,
                }}
              >
                <span className="text-lg">{style.icon}</span>
              </div>
            )
          })}

          {/* Render bullets */}
          {bullets.map((bullet) => {
            const angle = bullet.angle || 0
            return (
              <div
                key={bullet.id}
                className="w-2 h-4 bg-yellow-400 rounded-full absolute"
                style={{
                  transform: `translate(${bullet.x}px, ${bullet.y}px) rotate(${angle}deg)`,
                }}
              />
            )
          })}

          {/* Render player (Fighter Plane) */}
          <div
            ref={playerRef}
            className="absolute"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
              willChange: "transform", // Hint to browser to optimize transforms
              width: "48px",
              height: "48px",
            }}
          >
            {/* Main body of the plane */}
            <div className="absolute w-8 h-12 bg-blue-500 rounded-t-full left-1/2 -translate-x-1/2"></div>

            {/* Wings */}
            <div className="absolute w-full h-4 bg-blue-600 top-6 rounded-sm"></div>

            {/* Tail */}
            <div className="absolute w-6 h-3 bg-blue-700 bottom-0 left-1/2 -translate-x-1/2 rounded-b-sm"></div>

            {/* Cockpit */}
            <div className="absolute w-4 h-4 bg-cyan-300 rounded-full top-3 left-1/2 -translate-x-1/2"></div>

            {/* Engine flames */}
            <div className="absolute w-2 h-3 bg-orange-500 -bottom-2 left-1/2 -translate-x-1/2 rounded-b-full animate-pulse"></div>
          </div>
        </>
      )}
    </div>
  )
}
