"use client";
import React, { useState, useEffect, useRef } from "react";
import styles from "./SpeedReader.module.css";

// Utility functions
const formatTimeWithPadding = (minutes, seconds) => {
	const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
	return `${minutes}:${secondsStr}`;
};

const calculateTimeFromWords = (wordCount, wpm) => {
	const totalTimeInSeconds = (wordCount / wpm) * 60;
	const minutes = Math.floor(totalTimeInSeconds / 60);
	const seconds = Math.round(totalTimeInSeconds % 60);
	return { minutes, seconds };
};

// Function to split text into natural phrase chunks
const splitIntoPhrasesNatural = (text, maxWordsPerPhrase = 3) => {
	if (!text) return [];

	// Split text into sentences
	const sentences = text.split(/(?<=[.!?])\s+/);
	const phrases = [];

	sentences.forEach((sentence) => {
		// Split sentence into words
		const words = sentence.split(/\s+/).filter((word) => word.length > 0);

		// Group words into phrases (based on punctuation and length)
		let currentPhrase = [];
		let currentLength = 0;

		words.forEach((word, index) => {
			// Add word to current phrase
			currentPhrase.push(word);
			currentLength++;

			// Conditions to complete a phrase:
			// 1. Reached max words per phrase
			// 2. Encountered punctuation that would make a natural break
			// 3. Last word in sentence
			const hasPunctuation = /[,;:]$/.test(word);
			const isLastWord = index === words.length - 1;

			if (currentLength >= maxWordsPerPhrase || hasPunctuation || isLastWord) {
				phrases.push(currentPhrase.join(" "));
				currentPhrase = [];
				currentLength = 0;
			}
		});

		// Add any remaining words as a phrase
		if (currentPhrase.length > 0) {
			phrases.push(currentPhrase.join(" "));
		}
	});

	return phrases;
};

// Function to estimate optimal phrase reading time based on complexity
const calculatePhraseTime = (phrase, baseWpm) => {
	// Factors affecting reading time:
	// 1. Phrase length (word count)
	// 2. Word complexity (character count)
	// 3. Presence of punctuation

	const words = phrase.split(/\s+/);
	const wordCount = words.length;

	// Calculate average word length in the phrase
	const avgWordLength = phrase.replace(/\s+/g, "").length / wordCount;

	// Check for punctuation that might require a pause
	const hasPunctuation = /[,;.!?:]/.test(phrase);

	// Base time in milliseconds for the phrase
	let baseTimeMs = (wordCount / baseWpm) * 60 * 1000;

	// Adjust time based on complexity factors
	// Longer words take more time to process
	if (avgWordLength > 6) {
		baseTimeMs *= 1.2;
	}

	// Add a slight pause for phrases with punctuation
	if (hasPunctuation) {
		baseTimeMs *= 1.3;
	}

	return baseTimeMs;
};

// Function to create a smart highlight for the current phrase
const processPhrase = (phrase) => {
	if (!phrase) return { before: "", highlight: "", after: "" };

	const words = phrase.split(/\s+/);

	// For very short phrases, highlight the whole phrase
	if (words.length <= 1) {
		return { before: "", highlight: phrase, after: "" };
	}

	// For longer phrases, highlight a key portion (typically the second word or middle)
	const highlightIndex = Math.min(1, Math.floor(words.length / 2));

	return {
		before: words.slice(0, highlightIndex).join(" "),
		highlight: words[highlightIndex],
		after: words.slice(highlightIndex + 1).join(" "),
	};
};

const SpeedReader = () => {
	// State declarations
	const [text, setText] = useState("");
	const [phrases, setPhrases] = useState([]);
	const [phrasesHistory, setPhrasesHistory] = useState([]); // Store recently viewed phrases
	const [currentIndex, setCurrentIndex] = useState(-1);
	const [currentPosition, setCurrentPosition] = useState({ word: 0, phrase: 0 }); // Track word position for analytics
	const [isPlaying, setIsPlaying] = useState(false);
	const [wpm, setWpm] = useState(300);
	const [estimatedTime, setEstimatedTime] = useState({ minutes: 0, seconds: 0 });
	const [fontSizeLevel, setFontSizeLevel] = useState(2); // 0=small, 1=medium, 2=large
	const [darkMode, setDarkMode] = useState(true);
	const [focusMode, setFocusMode] = useState(false);
	const [saveModalOpen, setSaveModalOpen] = useState(false);
	const [savedTexts, setSavedTexts] = useState([]);
	const [textTitle, setTextTitle] = useState("");
	const [wordsPerPhrase, setWordsPerPhrase] = useState(3); // Default words per phrase
	const [smartTiming, setSmartTiming] = useState(true); // Adaptive timing based on phrase complexity
	const [showPhrasesHistory, setShowPhrasesHistory] = useState(false); // Toggle for history view
	const [comprehensionMode, setComprehensionMode] = useState(false); // Optimized for comprehension

	// References
	const timerIdRef = useRef(null);
	const textAreaRef = useRef(null);
	const displayAreaRef = useRef(null);
	const historyRef = useRef(null);

	// Load saved texts and user preferences from local storage
	useEffect(() => {
		const savedItems = localStorage.getItem("omniReaderSavedTexts");
		if (savedItems) {
			try {
				setSavedTexts(JSON.parse(savedItems));
			} catch (e) {
				console.error("Failed to parse saved texts", e);
			}
		}

		// Load user preferences
		const savedWpm = localStorage.getItem("omniReaderWpm");
		if (savedWpm) setWpm(Number(savedWpm));

		const savedDarkMode = localStorage.getItem("omniReaderDarkMode");
		if (savedDarkMode !== null) setDarkMode(savedDarkMode === "true");

		const savedFontSize = localStorage.getItem("omniReaderFontSize");
		if (savedFontSize !== null) setFontSizeLevel(Number(savedFontSize));

		const savedWordsPerPhrase = localStorage.getItem("omniReaderWordsPerPhrase");
		if (savedWordsPerPhrase !== null) setWordsPerPhrase(Number(savedWordsPerPhrase));

		const savedSmartTiming = localStorage.getItem("omniReaderSmartTiming");
		if (savedSmartTiming !== null) setSmartTiming(savedSmartTiming === "true");

		const savedComprehensionMode = localStorage.getItem("omniReaderComprehensionMode");
		if (savedComprehensionMode !== null)
			setComprehensionMode(savedComprehensionMode === "true");
	}, []);

	// Save user preferences when they change
	useEffect(() => {
		localStorage.setItem("omniReaderWpm", wpm);
		localStorage.setItem("omniReaderDarkMode", darkMode);
		localStorage.setItem("omniReaderFontSize", fontSizeLevel);
		localStorage.setItem("omniReaderWordsPerPhrase", wordsPerPhrase);
		localStorage.setItem("omniReaderSmartTiming", smartTiming);
		localStorage.setItem("omniReaderComprehensionMode", comprehensionMode);
	}, [wpm, darkMode, fontSizeLevel, wordsPerPhrase, smartTiming, comprehensionMode]);

	// Handle text input changes
	const handleTextChange = (e) => {
		const newText = e.target.value;
		setText(newText);

		// Process text into phrases
		const newPhrases = splitIntoPhrasesNatural(newText, wordsPerPhrase);
		setPhrases(newPhrases);
		setCurrentIndex(-1);
		setIsPlaying(false);
		setPhrasesHistory([]);
		setCurrentPosition({ word: 0, phrase: 0 });

		// Calculate estimated reading time
		const wordCount = newText.split(/\s+/).filter((word) => word.length > 0).length;
		calculateEstimatedTime(wordCount, wpm);
	};

	// Handle words per phrase change
	const handleWordsPerPhraseChange = (value) => {
		const newWordsPerPhrase = Math.max(1, Math.min(6, value));
		setWordsPerPhrase(newWordsPerPhrase);

		// Re-process text into phrases with new setting
		if (text) {
			const newPhrases = splitIntoPhrasesNatural(text, newWordsPerPhrase);
			setPhrases(newPhrases);
			setCurrentIndex(-1);
			setIsPlaying(false);
		}
	};

	// Calculate estimated reading time based on word count and WPM
	const calculateEstimatedTime = (wordCount, currentWpm) => {
		const time = calculateTimeFromWords(wordCount, currentWpm);
		setEstimatedTime(time);
	};

	// Toggle play/pause functionality
	const togglePlayPause = () => {
		if (isPlaying) {
			setIsPlaying(false);
		} else if (phrases.length > 0) {
			if (currentIndex === -1 || currentIndex >= phrases.length) setCurrentIndex(0);
			setIsPlaying(true);
		}
	};

	// Keyboard shortcuts for controlling the reader
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Skip if focused on text input
			if (document.activeElement === textAreaRef.current) return;

			switch (e.code) {
				case "Space": // Play/pause with spacebar
					e.preventDefault();
					togglePlayPause();
					break;
				case "ArrowLeft": // Previous phrase
					e.preventDefault();
					navigatePhrases(-1);
					break;
				case "ArrowRight": // Next phrase
					e.preventDefault();
					navigatePhrases(1);
					break;
				case "ArrowUp": // Increase speed
					e.preventDefault();
					adjustSpeed(50);
					break;
				case "ArrowDown": // Decrease speed
					e.preventDefault();
					adjustSpeed(-50);
					break;
				case "KeyF": // Toggle focus mode
					e.preventDefault();
					toggleFocusMode();
					break;
				case "KeyH": // Toggle history view
					e.preventDefault();
					setShowPhrasesHistory((prev) => !prev);
					break;
				case "KeyC": // Toggle comprehension mode
					e.preventDefault();
					setComprehensionMode((prev) => !prev);
					break;
				case "Escape": // Exit focus mode or close history
					if (focusMode) {
						e.preventDefault();
						setFocusMode(false);
					} else if (showPhrasesHistory) {
						e.preventDefault();
						setShowPhrasesHistory(false);
					}
					break;
				case "Backspace": // Quick rewind 5 phrases
					e.preventDefault();
					navigatePhrases(-5);
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isPlaying, phrases.length, currentIndex, wpm, focusMode, showPhrasesHistory]);

	// Adjust reading speed
	const handleWpmChange = (e) => {
		const newWpm = Number(e.target.value);
		setWpm(newWpm);

		// Recalculate estimated time
		const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
		calculateEstimatedTime(wordCount, newWpm);
	};

	// Speed control with buttons
	const adjustSpeed = (amount) => {
		setWpm((prevWpm) => {
			const newWpm = prevWpm + amount;
			const adjustedWpm = Math.min(Math.max(newWpm, 100), 1500);

			// Recalculate estimated time
			const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
			calculateEstimatedTime(wordCount, adjustedWpm);

			return adjustedWpm;
		});
	};

	// Navigate through phrases
	const navigatePhrases = (direction) => {
		if (phrases.length === 0) return;

		setCurrentIndex((prev) => {
			const newIndex = prev + direction;
			const boundedIndex = Math.max(0, Math.min(newIndex, phrases.length - 1));

			// Update phrases history for rewind/review
			if (boundedIndex >= 0 && boundedIndex < phrases.length) {
				// Only add to history when moving forward
				if (direction > 0 && prev >= 0) {
					setPhrasesHistory((prevHistory) => {
						// Keep only the last 20 phrases in history
						const newHistory = [...prevHistory, phrases[prev]];
						if (newHistory.length > 20) {
							return newHistory.slice(newHistory.length - 20);
						}
						return newHistory;
					});
				}

				// Update current position statistics
				const phraseWordCount = phrases[boundedIndex].split(/\s+/).length;
				setCurrentPosition((prevPosition) => ({
					word: prevPosition.word + (direction > 0 ? phraseWordCount : -phraseWordCount),
					phrase: boundedIndex,
				}));
			}

			return boundedIndex;
		});

		if (isPlaying && direction < 0) {
			// Stop auto-advance if moving backward
			setIsPlaying(false);
		}
	};

	// Reset to beginning
	const resetToStart = () => {
		setCurrentIndex(0);
		setIsPlaying(false);
		setCurrentPosition({ word: 0, phrase: 0 });
		setPhrasesHistory([]);
	};

	// Jump to end
	const jumpToEnd = () => {
		setCurrentIndex(phrases.length - 1);
		setIsPlaying(false);

		// Update position to end
		const totalWords = text.split(/\s+/).filter((word) => word.length > 0).length;
		setCurrentPosition({
			word: totalWords,
			phrase: phrases.length - 1,
		});
	};

	// Adjust font size
	const adjustFontSize = () => {
		setFontSizeLevel((prev) => (prev + 1) % 3);
	};

	// Toggle dark/light mode
	const toggleTheme = () => {
		setDarkMode((prev) => !prev);
	};

	// Toggle focus mode - hides all UI except the reader
	const toggleFocusMode = () => {
		setFocusMode((prev) => !prev);
		setShowPhrasesHistory(false); // Close history view when entering focus mode

		// If entering focus mode, ensure reader is visible
		if (!focusMode && displayAreaRef.current) {
			setTimeout(() => {
				displayAreaRef.current.scrollIntoView({ behavior: "smooth" });
			}, 100);
		}
	};

	// Toggle smart timing
	const toggleSmartTiming = () => {
		setSmartTiming((prev) => !prev);
	};

	// Toggle comprehension mode
	const toggleComprehensionMode = () => {
		setComprehensionMode((prev) => !prev);

		// Adjust settings for comprehension mode
		if (!comprehensionMode) {
			// Slower speed for better comprehension
			setWpm((prev) => Math.min(prev, 350));
			// Slightly shorter phrases
			setWordsPerPhrase(Math.min(wordsPerPhrase, 3));
		}
	};

	// Save current text
	const saveCurrentText = () => {
		if (!text.trim() || !textTitle.trim()) return;

		const newSavedText = {
			id: Date.now().toString(),
			title: textTitle,
			content: text,
			timestamp: new Date().toISOString(),
		};

		const updatedSavedTexts = [...savedTexts, newSavedText];
		setSavedTexts(updatedSavedTexts);
		localStorage.setItem("omniReaderSavedTexts", JSON.stringify(updatedSavedTexts));

		setSaveModalOpen(false);
		setTextTitle("");
	};

	// Load a saved text
	const loadSavedText = (savedText) => {
		setText(savedText.content);
		const newPhrases = splitIntoPhrasesNatural(savedText.content, wordsPerPhrase);
		setPhrases(newPhrases);
		setCurrentIndex(-1);
		setIsPlaying(false);
		setPhrasesHistory([]);
		setCurrentPosition({ word: 0, phrase: 0 });

		// Calculate estimated time
		const wordCount = savedText.content.split(/\s+/).filter((word) => word.length > 0).length;
		calculateEstimatedTime(wordCount, wpm);

		setSaveModalOpen(false);
	};

	// Delete a saved text
	const deleteSavedText = (id) => {
		const updatedSavedTexts = savedTexts.filter((item) => item.id !== id);
		setSavedTexts(updatedSavedTexts);
		localStorage.setItem("omniReaderSavedTexts", JSON.stringify(updatedSavedTexts));
	};

	// Manage phrase display timing
	useEffect(() => {
		if (isPlaying && currentIndex < phrases.length) {
			// Clear any existing timer
			if (timerIdRef.current) {
				clearTimeout(timerIdRef.current);
			}

			// Calculate time to display current phrase
			let interval;

			if (smartTiming) {
				// Calculate adaptive timing based on phrase complexity
				interval = calculatePhraseTime(phrases[currentIndex], wpm);
			} else {
				// Use standard timing based on WPM and word count
				const wordCount = phrases[currentIndex].split(/\s+/).length;
				interval = (wordCount / wpm) * 60 * 1000;
			}

			// Add additional pause for comprehension mode
			if (comprehensionMode) {
				interval *= 1.2;
			}

			// Set timer for next phrase
			timerIdRef.current = setTimeout(() => {
				// Move to next phrase
				navigatePhrases(1);
			}, interval);
		} else if (currentIndex >= phrases.length && isPlaying) {
			setIsPlaying(false);
		}

		return () => clearTimeout(timerIdRef.current);
	}, [isPlaying, currentIndex, wpm, phrases, smartTiming, comprehensionMode]);

	// Calculate estimated time on initial load and when dependencies change
	useEffect(() => {
		if (text) {
			const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
			calculateEstimatedTime(wordCount, wpm);
		}
	}, [text, wpm]);

	// Process current phrase for display
	let displayPhrase = "Ready";
	let processedPhrase = { before: "", highlight: "Ready", after: "" };

	if (currentIndex >= 0 && currentIndex < phrases.length) {
		displayPhrase = phrases[currentIndex];
		processedPhrase = processPhrase(displayPhrase);
	} else if (currentIndex >= phrases.length) {
		processedPhrase = { before: "End of", highlight: "text", after: "" };
	}

	// Calculate progress text
	let progressText = "0/0";
	if (phrases.length > 0) {
		const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
		progressText = `${displayIndex}/${phrases.length}`;
	}

	// Format the estimated time for display
	const formattedTime =
		text.length > 0
			? formatTimeWithPadding(estimatedTime.minutes, estimatedTime.seconds)
			: "0:00";

	// Progress percentage calculation
	const progressPercentage =
		phrases.length > 0 && currentIndex >= 0
			? Math.min((currentIndex / phrases.length) * 100, 100)
			: 0;

	// Calculate time remaining
	let formattedRemainingTime = formattedTime;
	if (phrases.length > 0 && currentIndex >= 0) {
		// Count words in remaining phrases
		const remainingWords =
			text.split(/\s+/).filter((word) => word.length > 0).length - currentPosition.word;
		const { minutes, seconds } = calculateTimeFromWords(remainingWords, wpm);
		formattedRemainingTime = formatTimeWithPadding(minutes, seconds);
	}

	// Font size classes based on level
	const fontSizeClass = [styles.fontSmall, styles.fontMedium, styles.fontLarge][fontSizeLevel];

	// Theme class for dark/light mode
	const themeClass = darkMode ? styles.darkMode : styles.lightMode;

	// Focus mode class
	const focusModeClass = focusMode ? styles.focusMode : "";

	// Comprehension mode class
	const comprehensionModeClass = comprehensionMode ? styles.comprehensionMode : "";

	// History class
	const historyClass = showPhrasesHistory ? styles.historyVisible : "";

	return (
		<div
			className={`${styles.speedReader} ${themeClass} ${focusModeClass} ${comprehensionModeClass}`}
		>
			<h2 className={styles.title}>Omni Speed Reader</h2>

			<div className={styles.twoColumnLayout}>
				{/* Left Column - Compact Control Panel */}
				<div className={styles.controlPanel}>
					{/* Consolidated Controls in Grid Layout */}
					<div className={styles.controlGrid}>
						{/* Main Reading Controls */}
						<div className={styles.gridSection}>oti
							<div className={styles.mainControls}>
								<button
									className={`${styles.mainButton} ${styles.backButton}`}
									onClick={() => navigatePhrases(-1)}
									aria-label="Previous phrase"
									data-tooltip="Previous phrase"
								>
									<span className={styles.buttonIcon}>◀</span>
								</button>

								<button
									onClick={togglePlayPause}
									className={`${styles.mainButton} ${styles.playPauseButton} ${
										isPlaying ? styles.pauseButton : ""
									}`}
									data-tooltip={isPlaying ? "Pause reading" : "Start reading"}
								>
									<span className={styles.buttonIcon}>
										{isPlaying ? "⏸" : "▶"}
									</span>
								</button>

								<button
									className={`${styles.mainButton} ${styles.forwardButton}`}
									onClick={() => navigatePhrases(1)}
									aria-label="Next phrase"
									data-tooltip="Next phrase"
								>
									<span className={styles.buttonIcon}>▶</span>
								</button>
							</div>

							<div className={styles.secondaryControls}>
								<button
									className={styles.controlButton}
									onClick={resetToStart}
									aria-label="Reset to beginning"
									data-tooltip="Start from beginning"
								>
									<span className={styles.controlIcon}>⏮</span>
								</button>
								<button
									className={styles.controlButton}
									onClick={() => navigatePhrases(-5)}
									aria-label="Back 5 phrases"
									data-tooltip="Back 5 phrases"
								>
									<span className={styles.controlIcon}>⏪</span>
								</button>
								<button
									className={styles.controlButton}
									onClick={() => navigatePhrases(5)}
									aria-label="Forward 5 phrases"
									data-tooltip="Forward 5 phrases"
								>
									<span className={styles.controlIcon}>⏩</span>
								</button>
								<button
									className={styles.controlButton}
									onClick={jumpToEnd}
									aria-label="Jump to end"
									data-tooltip="Jump to end"
								>
									<span className={styles.controlIcon}>⏭</span>
								</button>
							</div>
						</div>
						{/* Reading Stats */}
						{text.length > 0 && (
							<div className={styles.gridSection}>
								<div className={styles.sectionTitle}>
									<span className={styles.sectionIcon}>📊</span>
									<span>Stats</span>
								</div>
								<div className={styles.statsGrid}>
									<div className={styles.statItem}>
										<span className={styles.statValue}>
											{
												text.split(/\s+/).filter((word) => word.length > 0)
													.length
											}
										</span>
										<span className={styles.statLabel}>Words</span>
									</div>
									<div className={styles.statItem}>
										<span className={styles.statValue}>{phrases.length}</span>
										<span className={styles.statLabel}>Phrases</span>
									</div>
									<div className={styles.statItem}>
										<span className={styles.statValue}>{progressText}</span>
										<span className={styles.statLabel}>Progress</span>
									</div>
									<div className={styles.statItem}>
										<span className={styles.statValue}>
											{currentIndex >= 0
												? formattedRemainingTime
												: formattedTime}
										</span>
										<span className={styles.statLabel}>Time</span>
									</div>
								</div>
							</div>
						)}
						{/* Speed Controls */}
						<div className={styles.gridSection}>
							<div className={styles.sectionTitle}>
								<span className={styles.sectionIcon}>⚡</span>
								<span>Speed</span>
								<span className={styles.valueDisplay}>{wpm} wpm</span>
							</div>
							<div className={styles.speedSlider}>
								<button
									className={styles.speedButton}
									onClick={() => adjustSpeed(-50)}
									aria-label="Decrease speed"
									data-tooltip="Slower (-50 wpm)"
								>
									−
								</button>
								<input
									type="range"
									min="100"
									max="1000"
									step="50"
									value={wpm}
									onChange={handleWpmChange}
									className={styles.slider}
									aria-label="Reading speed"
								/>
								<button
									className={styles.speedButton}
									onClick={() => adjustSpeed(50)}
									aria-label="Increase speed"
									data-tooltip="Faster (+50 wpm)"
								>
									+
								</button>
							</div>
						</div>

						{/* Phrase Length Controls */}
						<div className={styles.gridSection}>
							<div className={styles.sectionTitle}>
								<span className={styles.sectionIcon}>📏</span>
								<span>Phrase Length</span>
							</div>
							<div className={styles.phraseButtons}>
								<button
									className={`${styles.phraseLengthButton} ${
										wordsPerPhrase === 1 ? styles.active : ""
									}`}
									onClick={() => handleWordsPerPhraseChange(1)}
									aria-label="1 word per phrase"
									data-tooltip="Single word mode"
								>
									1
								</button>
								<button
									className={`${styles.phraseLengthButton} ${
										wordsPerPhrase === 2 ? styles.active : ""
									}`}
									onClick={() => handleWordsPerPhraseChange(2)}
									aria-label="2 words per phrase"
									data-tooltip="2 words per phrase"
								>
									2
								</button>
								<button
									className={`${styles.phraseLengthButton} ${
										wordsPerPhrase === 3 ? styles.active : ""
									}`}
									onClick={() => handleWordsPerPhraseChange(3)}
									aria-label="3 words per phrase"
									data-tooltip="3 words per phrase"
								>
									3
								</button>
								<button
									className={`${styles.phraseLengthButton} ${
										wordsPerPhrase === 4 ? styles.active : ""
									}`}
									onClick={() => handleWordsPerPhraseChange(4)}
									aria-label="4 words per phrase"
									data-tooltip="4 words per phrase"
								>
									4
								</button>
								<button
									className={`${styles.phraseLengthButton} ${
										wordsPerPhrase === 5 ? styles.active : ""
									}`}
									onClick={() => handleWordsPerPhraseChange(5)}
									aria-label="5+ words per phrase"
									data-tooltip="5+ words per phrase"
								>
									5+
								</button>
							</div>
						</div>

						{/* Settings toggles as icon buttons */}
						<div className={styles.gridSection}>
							<div className={styles.sectionTitle}>
								<span className={styles.sectionIcon}>⚙️</span>
								<span>Settings</span>
							</div>

							<div className={styles.settingsGrid}>
								<button
									className={`${styles.settingButton} ${
										showPhrasesHistory ? styles.active : ""
									}`}
									onClick={() => setShowPhrasesHistory((prev) => !prev)}
									aria-label="Show phrase history"
									data-tooltip="Recent phrases"
								>
									<span className={styles.settingIcon}>📜</span>
								</button>
								<button
									className={`${styles.settingButton} ${
										smartTiming ? styles.active : ""
									}`}
									onClick={toggleSmartTiming}
									aria-label="Toggle smart timing"
									data-tooltip="Smart timing"
								>
									<span className={styles.settingIcon}>⏱️</span>
								</button>
								<button
									className={`${styles.settingButton} ${
										comprehensionMode ? styles.active : ""
									}`}
									onClick={toggleComprehensionMode}
									aria-label="Toggle comprehension mode"
									data-tooltip="Comprehension mode"
								>
									<span className={styles.settingIcon}>🧠</span>
								</button>
								<button
									className={`${styles.settingButton} ${
										focusMode ? styles.active : ""
									}`}
									onClick={toggleFocusMode}
									aria-label="Toggle focus mode"
									data-tooltip="Focus mode"
								>
									<span className={styles.settingIcon}>👁️</span>
								</button>
								<button
									className={styles.settingButton}
									onClick={adjustFontSize}
									aria-label="Change font size"
									data-tooltip="Font size"
								>
									<span className={styles.settingIcon}>Aa</span>
								</button>
								<button
									className={styles.settingButton}
									onClick={toggleTheme}
									aria-label="Toggle dark/light mode"
									data-tooltip={darkMode ? "Light mode" : "Dark mode"}
								>
									<span className={styles.settingIcon}>
										{darkMode ? "☀️" : "🌙"}
									</span>
								</button>
								<button
									className={styles.settingButton}
									onClick={() => setSaveModalOpen(true)}
									aria-label="Save/Load Text"
									data-tooltip="Save/Load"
								>
									<span className={styles.settingIcon}>💾</span>
								</button>
								<button
									className={styles.settingButton}
									onClick={() =>
										document
											.getElementById("shortcutsModal")
											.classList.toggle(styles.visible)
									}
									aria-label="Keyboard shortcuts"
									data-tooltip="Shortcuts"
								>
									<span className={styles.settingIcon}>⌨️</span>
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column - Reading Area */}
				<div className={styles.readingPanel}>
					{/* Display Area with click-to-pause functionality */}
					<div
						className={`${styles.displayContainer} ${historyClass}`}
						ref={displayAreaRef}
					>
						<div className={styles.displayArea} onClick={togglePlayPause}>
							<div className={styles.focusLine}></div>
							<div className={`${styles.phrase} ${fontSizeClass}`}>
								<span className={styles.phraseBefore}>
									{processedPhrase.before}
								</span>
								{processedPhrase.before && " "}
								<span className={styles.phraseHighlight}>
									{processedPhrase.highlight}
								</span>
								{processedPhrase.after && " "}
								<span className={styles.phraseAfter}>{processedPhrase.after}</span>
							</div>

							{focusMode && (
								<button
									className={styles.exitFocusButton}
									onClick={(e) => {
										e.stopPropagation();
										setFocusMode(false);
									}}
									aria-label="Exit focus mode"
								>
									<span className={styles.exitIcon}>✕</span>
								</button>
							)}
						</div>

						{/* Phrases History Panel */}
						{showPhrasesHistory && (
							<div className={styles.historyPanel} ref={historyRef}>
								<div className={styles.historyHeader}>
									<h3>Recently Read Phrases</h3>
									<button
										className={styles.closeHistoryButton}
										onClick={() => setShowPhrasesHistory(false)}
										aria-label="Close history"
									>
										✕
									</button>
								</div>
								<div className={styles.historyContent}>
									{phrasesHistory.length > 0 ? (
										<ul className={styles.historyList}>
											{phrasesHistory.map((phrase, index) => (
												<li
													key={index}
													className={styles.historyItem}
													onClick={() => {
														// Find and go to this phrase in the original text
														const phraseIndex = phrases.indexOf(phrase);
														if (phraseIndex >= 0) {
															setCurrentIndex(phraseIndex);
															setIsPlaying(false);
														}
													}}
												>
													{phrase}
												</li>
											))}
										</ul>
									) : (
										<p className={styles.noHistory}>
											No phrases in history yet. Start reading to see recent
											phrases here.
										</p>
									)}
								</div>
							</div>
						)}

						<div className={styles.progressBarContainer}>
							<div className={styles.progressBar}>
								<div
									className={styles.progressFill}
									style={{ width: `${progressPercentage}%` }}
								></div>
							</div>
						</div>
					</div>

					{/* Text Input Area */}
					<textarea
						ref={textAreaRef}
						className={styles.textArea}
						value={text}
						onChange={handleTextChange}
						placeholder="Enter your text here to speed read..."
					/>
				</div>
			</div>

			{/* Keyboard shortcuts help - moved modal outside layout */}
			<div id="shortcutsModal" className={styles.shortcutsModal}>
				<div className={styles.shortcutsContent}>
					<h3>Keyboard Shortcuts</h3>
					<div className={styles.shortcutGrid}>
						<div className={styles.shortcutItem}>
							<kbd>Space</kbd> Play/Pause
						</div>
						<div className={styles.shortcutItem}>
							<kbd>←</kbd> Previous phrase
						</div>
						<div className={styles.shortcutItem}>
							<kbd>→</kbd> Next phrase
						</div>
						<div className={styles.shortcutItem}>
							<kbd>↑</kbd> Increase speed
						</div>
						<div className={styles.shortcutItem}>
							<kbd>↓</kbd> Decrease speed
						</div>
						<div className={styles.shortcutItem}>
							<kbd>Backspace</kbd> Rewind 5 phrases
						</div>
						<div className={styles.shortcutItem}>
							<kbd>F</kbd> Toggle focus mode
						</div>
						<div className={styles.shortcutItem}>
							<kbd>H</kbd> Toggle history view
						</div>
						<div className={styles.shortcutItem}>
							<kbd>C</kbd> Toggle comprehension mode
						</div>
						<div className={styles.shortcutItem}>
							<kbd>Esc</kbd> Exit focus/history
						</div>
					</div>
					<button
						className={styles.closeButton}
						onClick={() =>
							document
								.getElementById("shortcutsModal")
								.classList.remove(styles.visible)
						}
					>
						Close
					</button>
				</div>
			</div>

			{/* Save/Load Modal */}
			{saveModalOpen && (
				<div className={styles.modalOverlay}>
					<div className={styles.modal}>
						<div className={styles.modalHeader}>
							<h3>Save / Load Text</h3>
							<button
								className={styles.closeModalButton}
								onClick={() => setSaveModalOpen(false)}
								aria-label="Close modal"
							>
								✕
							</button>
						</div>

						<div className={styles.modalContent}>
							{/* Save new text section */}
							<div className={styles.saveTextSection}>
								<h4>Save Current Text</h4>
								<input
									type="text"
									placeholder="Enter title for this text"
									value={textTitle}
									onChange={(e) => setTextTitle(e.target.value)}
									className={styles.modalInput}
								/>
								<button
									className={styles.saveButton}
									onClick={saveCurrentText}
									disabled={!text.trim() || !textTitle.trim()}
								>
									Save Text
								</button>
							</div>

							{/* Saved texts list */}
							<div className={styles.savedTextsList}>
								<h4>Your Saved Texts</h4>
								{savedTexts.length === 0 ? (
									<p className={styles.noSavedTexts}>No saved texts yet.</p>
								) : (
									<ul className={styles.textsList}>
										{savedTexts.map((item) => (
											<li key={item.id} className={styles.savedTextItem}>
												<div className={styles.savedTextInfo}>
													<span className={styles.savedTextTitle}>
														{item.title}
													</span>
													<span className={styles.savedTextDate}>
														{new Date(
															item.timestamp
														).toLocaleDateString()}
													</span>
												</div>
												<div className={styles.savedTextActions}>
													<button
														onClick={() => loadSavedText(item)}
														className={styles.loadButton}
														aria-label={`Load ${item.title}`}
													>
														Load
													</button>
													<button
														onClick={() => deleteSavedText(item.id)}
														className={styles.deleteButton}
														aria-label={`Delete ${item.title}`}
													>
														Delete
													</button>
												</div>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SpeedReader;
