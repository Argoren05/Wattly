/**
 * Runs after the test framework is installed.
 *
 * CI runners start with a cold transform cache: the first test of every suite compiles the screen's modules,
 * which can take several seconds. Async queries (findBy*, waitFor) therefore get a timeout that covers a cold
 * start instead of the default 1 s tuned for a warm developer machine.
 */
import { configure } from '@testing-library/react-native';

configure({ asyncUtilTimeout: 5000 });
