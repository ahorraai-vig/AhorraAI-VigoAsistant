import React from 'react';
import { motion } from 'motion/react';
import { Store, Coffee, ShoppingBag, UtensilsCrossed, Building2, MapPin, Sparkles, HeartHandshake, Scissors, Camera, Book, Bike, Dumbbell } from 'lucide-react';

const icons = [Store, Coffee, ShoppingBag, UtensilsCrossed, Building2, MapPin, Sparkles, HeartHandshake, Scissors, Camera, Book, Bike, Dumbbell];

export function FloatingIconsBackground() {
  const [elements, setElements] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Generate random initial positions and assignments only once on client
    const newElements = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      Icon: icons[Math.floor(Math.random() * icons.length)],
      initialX: Math.random() * 100,
      initialY: Math.random() * 100,
      duration: 30 + Math.random() * 20,
      delay: Math.random() * 10,
      size: 32 + Math.random() * 64,
      opacity: 0.1 + Math.random() * 0.2
    }));
    setElements(newElements);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black opacity-90" />
      {elements.map((el) => (
        <motion.div
          key={el.id}
          className="absolute"
          initial={{
            left: `${el.initialX}vw`,
            top: `${el.initialY}vh`,
            opacity: 0,
            rotate: 0,
          }}
          animate={{
            left: [
              `${el.initialX}vw`,
              `${el.initialX + (Math.random() * 10 - 5)}vw`,
              `${el.initialX - (Math.random() * 10 - 5)}vw`,
              `${el.initialX}vw`,
            ],
            top: [
              `${el.initialY}vh`,
              `${el.initialY - (Math.random() * 15 + 5)}vh`,
              `${el.initialY + (Math.random() * 15 + 5)}vh`,
              `${el.initialY}vh`,
            ],
            opacity: [0, el.opacity, el.opacity, 0],
            rotate: [0, 45, -45, 0],
          }}
          transition={{
            duration: el.duration,
            repeat: Infinity,
            delay: el.delay,
            ease: "easeInOut",
          }}
        >
          <el.Icon 
            size={el.size} 
            color="white" 
            strokeWidth={1}
          />
        </motion.div>
      ))}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
    </div>
  );
}
