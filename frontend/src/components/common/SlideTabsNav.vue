<template>
  <nav class="elegant-menu" :aria-label="$t('common.menu')">
    <router-link
      v-for="item in navItems"
      :key="item.name"
      :to="item.path"
      class="elegant-menu__item"
      :class="{ active: isActive(item) }"
      :aria-current="isActive(item) ? 'page' : undefined"
    >
      <component :is="item.icon" :size="17" stroke-width="1.8" />
      <span>{{ $t(`menu.${item.i18nKey}`) }}</span>
      <span v-if="item.badgeKey" class="elegant-menu__badge">{{ $t(`menu.${item.badgeKey}`) }}</span>
    </router-link>
  </nav>
</template>

<script>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { INVITE_CONFIG, NAVIGATION_CONFIG, SHOP_CONFIG } from '@/utils/baseConfig';
import IconDashboard from '@/components/icons/IconDashboard.vue';
import IconShop from '@/components/icons/IconShop.vue';
import IconInvite from '@/components/icons/IconInvite.vue';
import IconFileText from '@/components/icons/IconFileText.vue';
import IconWallet from '@/components/icons/IconWallet.vue';
import IconUser from '@/components/icons/IconUser.vue';
import IconMore from '@/components/icons/IconMore.vue';
import { IconChartBar, IconHeadset, IconServer } from '@tabler/icons-vue';

export default {
  name: 'SlideTabsNav',
  components: {
    IconChartBar,
    IconHeadset,
    IconServer,
    IconDashboard,
    IconShop,
    IconInvite,
    IconFileText,
    IconWallet,
    IconUser,
    IconMore
  },
  setup() {
    const route = useRoute();

    const navItems = computed(() => {
      const map = {
        docs: { name: 'Docs', path: '/docs', icon: IconFileText, i18nKey: 'docs' },
        invite: { name: 'Invite', path: '/invite', icon: IconInvite, i18nKey: 'invite', badgeKey: INVITE_CONFIG?.showCommissionBadge ? 'hot' : '' },
        tickets: { name: 'Tickets', path: '/tickets', icon: IconHeadset, i18nKey: 'tickets' },
        nodes: { name: 'Nodes', path: '/nodes', icon: IconServer, i18nKey: 'nodes' },
        orders: { name: 'Orders', path: '/orders', icon: IconShop, i18nKey: 'orders' },
        traffic: { name: 'TrafficLog', path: '/trafficlog', icon: IconChartBar, i18nKey: 'traffic' },
        wallet: { name: 'Deposit', path: '/wallet/deposit', icon: IconWallet, i18nKey: 'wallet' },
        profile: { name: 'Profile', path: '/profile', icon: IconUser, i18nKey: 'profile' }
      };

      const items = [
        { name: 'Dashboard', path: '/dashboard', icon: IconDashboard, i18nKey: 'dashboard' },
        { name: 'Shop', path: '/shop', icon: IconShop, i18nKey: 'shop', badgeKey: SHOP_CONFIG?.showHotSaleBadge ? 'hotSale' : '' }
      ];
      const third = map[NAVIGATION_CONFIG?.thirdNavItem || 'invite'];
      const fourth = map[NAVIGATION_CONFIG?.fourthNavItem || 'docs'];
      if (third) items.push(third);
      if (fourth && fourth.name !== third?.name) items.push(fourth);
      items.push({ name: 'More', path: '/more', icon: IconMore, i18nKey: 'more' });
      return items;
    });

    const isActive = (item) => route.name === item.name || route.meta?.activeNav === item.name;

    return { navItems, isActive };
  }
};
</script>
