import { motion } from "framer-motion";

export function LoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-8">
        <motion.div
          className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 relative"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 90, 180, 270, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500"
            animate={{
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
        <div className="space-y-2 text-center">
          <h3 className="text-xl font-medium text-white">Creating your agent</h3>
          <p className="text-zinc-400">
            Assembling tools and configuring capabilities...
          </p>
        </div>
      </div>
    </motion.div>
  );
} 