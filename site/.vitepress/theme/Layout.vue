<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import { onBeforeUnmount, onMounted, ref, watchEffect } from "vue";
import { useData } from "vitepress";

const { frontmatter } = useData();
const fallbackGithubStars = "9,946";
const githubStars = ref(fallbackGithubStars);
const githubStarsCacheKey = "tolaria:github-stars";
const githubStarsCacheTtlMs = 60 * 60 * 1000;
const githubRepoApiUrl = "https://api.github.com/repos/refactoringhq/tolaria";

type GithubStarsCache = {
  stars: number;
  savedAt: number;
};

const formatGithubStars = (stars: number) =>
  new Intl.NumberFormat("en-US").format(stars);

const scrollClass = "tolaria-scrolled";
const landingPageClass = "tolaria-landing-page";
const updateScrollClass = () => {
  document.documentElement.classList.toggle(scrollClass, window.scrollY > 8);
};

const readCachedGithubStars = (): GithubStarsCache | null => {
  try {
    const rawCache = window.localStorage.getItem(githubStarsCacheKey);
    if (!rawCache) {
      return null;
    }

    const parsedCache = JSON.parse(rawCache) as Partial<GithubStarsCache>;
    if (
      typeof parsedCache.stars !== "number" ||
      typeof parsedCache.savedAt !== "number" ||
      !Number.isFinite(parsedCache.stars) ||
      !Number.isFinite(parsedCache.savedAt)
    ) {
      return null;
    }

    return {
      stars: parsedCache.stars,
      savedAt: parsedCache.savedAt,
    };
  } catch {
    return null;
  }
};

const updateGithubStars = async () => {
  const cachedStars = readCachedGithubStars();
  if (cachedStars) {
    githubStars.value = formatGithubStars(cachedStars.stars);
    if (Date.now() - cachedStars.savedAt < githubStarsCacheTtlMs) {
      return;
    }
  }

  try {
    const response = await fetch(githubRepoApiUrl, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      return;
    }

    const repo = (await response.json()) as { stargazers_count?: unknown };
    if (
      typeof repo.stargazers_count !== "number" ||
      !Number.isFinite(repo.stargazers_count)
    ) {
      return;
    }

    window.localStorage.setItem(
      githubStarsCacheKey,
      JSON.stringify({
        stars: repo.stargazers_count,
        savedAt: Date.now(),
      } satisfies GithubStarsCache),
    );
    githubStars.value = formatGithubStars(repo.stargazers_count);
  } catch {
    // Keep the cached or bundled fallback count.
  }
};

watchEffect(() => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle(
    landingPageClass,
    Boolean(frontmatter.value.landing),
  );
});

onMounted(() => {
  updateScrollClass();
  void updateGithubStars();
  window.addEventListener("scroll", updateScrollClass, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateScrollClass);
  document.documentElement.classList.remove(scrollClass);
  document.documentElement.classList.remove(landingPageClass);
});
</script>

<template>
  <div :class="{ 'tolaria-landing-shell': frontmatter.landing }">
    <DefaultTheme.Layout>
      <template #nav-bar-content-after>
        <a
          class="github-star-widget"
          href="https://github.com/refactoringhq/tolaria"
          target="_blank"
          rel="noreferrer"
          :aria-label="`${githubStars} GitHub stars`"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18A11 11 0 0 1 12 5.53c.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.79.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
            />
          </svg>
          <span>Star</span>
          <strong>{{ githubStars }}</strong>
        </a>
      </template>
    </DefaultTheme.Layout>
  </div>
</template>

<style scoped>
.github-star-widget {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  margin-left: 8px;
  padding: 0 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 7px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease;
}

.github-star-widget:hover {
  color: var(--vp-c-brand-1);
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 38%, var(--vp-c-border));
}

.github-star-widget svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.github-star-widget strong {
  padding-left: 7px;
  border-left: 1px solid var(--vp-c-border);
  font-weight: 800;
}

@media (min-width: 1280px) {
  .github-star-widget {
    order: 1;
  }

  :global(.VPNavBar .appearance) {
    order: 2;
  }
}

@media (max-width: 767px) {
  .github-star-widget {
    height: 32px;
    margin-left: 4px;
    padding: 0 7px;
    font-size: 12px;
  }

  .github-star-widget svg {
    width: 17px;
    height: 17px;
  }

  .github-star-widget span {
    display: none;
  }

  .github-star-widget strong {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
