import { installReadingFeature } from "./reading-features"
import { enhanceSidenotes } from "./sidenotes-reader"

installReadingFeature("[data-has-sidenotes]", enhanceSidenotes)
