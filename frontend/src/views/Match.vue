<template>
  <div class="min-h-screen pb-20 bg-background text-foreground transition-colors duration-300">
    <TopNav title="匹配">
      <template #extra>
        <router-link to="/match-history" class="glass-btn px-4 py-1.5 text-sm rounded-full active:scale-95 transition-all">
          匹配历史
        </router-link>
      </template>
    </TopNav>

    <div class="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
      <!-- 匹配设置卡片 -->
      <div class="glass-card p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground/90">匹配设置</h2>
          <div v-if="queueCount > 0" class="glass-badge px-3 py-1 text-xs text-foreground/60">
            {{ queueCount }} 人在排队
          </div>
        </div>

        <div class="space-y-6">
          <!-- 年龄范围 -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-foreground/70">年龄范围</label>
              <label class="flex items-center text-sm text-foreground/50 cursor-pointer group">
                <input
                  type="checkbox"
                  v-model="matchSettings.enableAgeRange"
                  class="mr-2 w-4 h-4 rounded-full border-foreground/20 bg-foreground/5 checked:bg-primary transition-all"
                />
                <span class="group-active:opacity-70">启用限制</span>
              </label>
            </div>
            <div class="flex items-center gap-3">
              <input
                v-model.number="matchSettings.ageRange[0]"
                type="number"
                min="18"
                max="100"
                class="glass-input flex-1 text-center"
                :disabled="!matchSettings.enableAgeRange"
              />
              <span class="text-foreground/30">-</span>
              <input
                v-model.number="matchSettings.ageRange[1]"
                type="number"
                min="18"
                max="100"
                class="glass-input flex-1 text-center"
                :disabled="!matchSettings.enableAgeRange"
              />
            </div>
          </div>

          <!-- 匹配模式 -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-foreground/70">匹配模式</label>
            <GlassSelect v-model="matchSettings.matchingMode" :options="matchingModeOptions" />
            <p class="text-xs text-foreground/40 leading-relaxed">
              {{ getMatchingModeDescription(matchSettings.matchingMode) }}
            </p>
          </div>

          <!-- 性别偏好 -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-foreground/70">性别偏好</label>
            <GlassSelect v-model="matchSettings.gender" :options="genderOptions" />
          </div>

          <!-- 地区设置 -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-foreground/70">地区选择</label>
            <div class="grid grid-cols-2 gap-3">
              <GlassSelect
                v-model="selectedProvince"
                :options="provinces"
                label-key="name"
                value-key="name"
                placeholder="省份"
                @change="() => { selectedCity = ''; updateLocation(); }"
              />
              <GlassSelect
                v-model="selectedCity"
                :options="currentCities"
                placeholder="城市"
                :disabled="!selectedProvince"
                @change="updateLocation"
              />
            </div>
          </div>

          <!-- 匿名设置 -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-foreground/70">匿名设置</label>
              <label class="flex items-center text-sm text-foreground/50 cursor-pointer group">
                <input
                  type="checkbox"
                  v-model="matchSettings.use_anonymous"
                  class="mr-2 w-4 h-4 rounded-full border-foreground/20 bg-foreground/5 checked:bg-primary transition-all"
                />
                <span class="group-active:opacity-70">开启匿名</span>
              </label>
            </div>
            
            <div class="grid grid-cols-3 gap-2 p-1 glass rounded-2xl">
              <button 
                v-for="opt in anonymousOptions"
                :key="opt.value"
                type="button"
                class="py-2.5 text-xs font-medium rounded-xl transition-all active:scale-95"
                :class="matchSettings.is_anonymous === opt.value ? 'glass-btn-primary' : 'text-foreground/60 hover:text-white'"
                @click="matchSettings.is_anonymous = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            
            <p class="text-xs text-foreground/40 leading-relaxed bg-foreground/5 p-3 rounded-xl border border-foreground/5">
              <span v-if="matchSettings.use_anonymous" class="text-primary font-medium block mb-1">
                您当前已开启匿名身份，对方将无法看到您的头像和昵称
              </span>
              {{ getAnonymousDescription(matchSettings.is_anonymous) }}
            </p>
          </div>

          <!-- 保存按钮 -->
          <button
            @click="saveSettings"
            class="w-full glass-btn-primary py-4 rounded-2xl font-semibold shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            :disabled="saving"
          >
            <span v-if="saving" class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              保存中...
            </span>
            <span v-else>保存匹配设置</span>
          </button>
        </div>
      </div>

      <!-- 开始匹配区域 -->
      <div class="pt-6 pb-12 flex flex-col items-center">
        <button
          v-if="!matching"
          @click="startMatch"
          class="group relative"
        >
          <div class="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div class="relative glass-btn-primary text-xl px-12 py-6 rounded-full font-bold shadow-2xl active:scale-95 transition-all">
            开始匹配
          </div>
        </button>
        
        <div v-else class="w-full space-y-8 animate-in fade-in zoom-in duration-300">
          <div class="flex flex-col items-center space-y-6">
            <div class="relative w-32 h-32">
              <div class="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"></div>
              <div class="absolute inset-0 rounded-full border-4 border-primary/40 animate-pulse delay-75"></div>
              <div class="absolute inset-2 glass rounded-full flex items-center justify-center">
                <div class="w-4 h-4 bg-primary rounded-full animate-bounce"></div>
              </div>
            </div>
            
            <div class="text-center space-y-2">
              <h3 class="text-xl font-bold text-white">正在寻找缘分...</h3>
              <p class="text-foreground/40 text-sm">已排队 {{ queueCount }} 人，预计等待 1-2 分钟</p>
            </div>

            <div class="w-full max-w-xs space-y-3">
              <button
                @click="accelerateMatch"
                class="w-full glass-btn-primary py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
                :disabled="accelerating"
              >
                {{ accelerating ? '加速中...' : `加速匹配 (消耗 ${getAccelerateCost()} 积分)` }}
              </button>
              
              <button
                @click="cancelMatch"
                class="w-full glass-btn py-3 rounded-2xl text-sm font-medium text-red-400/80 active:scale-95 transition-all"
              >
                取消匹配
              </button>
              
              <p v-if="queueJumpCount > 0" class="text-center text-[10px] text-foreground/30 uppercase tracking-wider">
                已加速 {{ queueJumpCount }} 次
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/utils/api';
import GlassSelect from '@/components/GlassSelect.vue';
import TopNav from '@/components/TopNav.vue';
import BottomNav from '@/components/BottomNav.vue';

const router = useRouter();

const matchingModeOptions = [
  { value: 'precise', label: '精准匹配' },
  { value: 'interest', label: '兴趣匹配' },
  { value: 'nearby', label: '附近匹配' },
  { value: 'random', label: '随机匹配' }
];

const genderOptions = [
  { value: null, label: '不限' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

const anonymousOptions = [
  { value: 'all', label: '全部接受' },
  { value: 'none', label: '不要匿名' },
  { value: 'only', label: '只要匿名' }
];

const matching = ref(false);
const saving = ref(false);
const accelerating = ref(false);
const queueCount = ref(0);
const queueJumpCount = ref(0);
const pollInterval = ref<any>(null);
const onlineCount = ref(0);

const matchSettings = ref<{
  ageRange: number[];
  enableAgeRange: boolean;
  gender: string | null;
  location: string | null;
  matchingMode: string;
  is_anonymous: string;
  use_anonymous: boolean;
}>({
  ageRange: [18, 50],
  enableAgeRange: true,
  gender: null,
  location: null,
  matchingMode: 'precise',
  is_anonymous: 'all',
  use_anonymous: false
});

// 省市区数据
const provinces = [
  { name: '北京', cities: ['北京'] },
  { name: '上海', cities: ['上海'] },
  { name: '广东', cities: ['广州', '深圳', '东莞', '佛山', '珠海', '汕头', '中山', '惠州', '江门', '湛江', '肇庆', '茂名', '揭阳', '汕头', '清远', '韶关', '阳江', '梅州', '潮州', '河源', '汕尾', '云浮'] },
  { name: '江苏', cities: ['南京', '苏州', '无锡', '常州', '南通', '徐州', '盐城', '扬州', '泰州', '镇江', '淮安', '连云港', '宿迁', '常州'] },
  { name: '浙江', cities: ['杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水'] },
  { name: '山东', cities: ['济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽'] },
  { name: '河南', cities: ['郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店'] },
  { name: '河北', cities: ['石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水'] },
  { name: '湖南', cities: ['长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底'] },
  { name: '湖北', cities: ['武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州'] },
  { name: '四川', cities: ['成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳'] },
  { name: '辽宁', cities: ['沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛'] },
  { name: '安徽', cities: ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城'] },
  { name: '福建', cities: ['福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德'] },
  { name: '重庆', cities: ['重庆'] },
  { name: '天津', cities: ['天津'] },
  { name: '陕西', cities: ['西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛'] },
  { name: '江西', cities: ['南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶'] },
  { name: '黑龙江', cities: ['哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化'] },
  { name: '吉林', cities: ['长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城'] },
  { name: '云南', cities: ['昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧'] },
  { name: '山西', cities: ['太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁'] },
  { name: '贵州', cities: ['贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁'] },
  { name: '广西', cities: ['南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左'] },
  { name: '内蒙古', cities: ['呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布'] },
  { name: '新疆', cities: ['乌鲁木齐', '克拉玛依', '吐鲁番', '哈密'] },
  { name: '甘肃', cities: ['兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南'] },
  { name: '宁夏', cities: ['银川', '石嘴山', '吴忠', '固原', '中卫'] },
  { name: '青海', cities: ['西宁', '海东'] },
  { name: '西藏', cities: ['拉萨'] }
];

const selectedProvince = ref('');
const selectedCity = ref('');

const currentCities = computed(() => {
  const province = provinces.find(p => p.name === selectedProvince.value);
  return province ? province.cities : [];
});

onMounted(async () => {
  await fetchSettings();
  await fetchQueueCount();
  await fetchOnlineCount();
  
  const interval = setInterval(fetchOnlineCount, 30000);
  
  if (router.currentRoute.value.query.autoMatch === 'true') {
    startMatch();
  }

  onUnmounted(() => {
    clearInterval(interval);
  });
});

onUnmounted(() => {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
  }
});

async function fetchSettings() {
  try {
    const response = await api.get('/match/settings');
    if (response.data.settings) {
      const settings = response.data.settings;
      matchSettings.value = {
        ageRange: [settings.min_age || 18, settings.max_age || 50],
        enableAgeRange: settings.enable_age_range !== undefined ? settings.enable_age_range : true,
        gender: settings.preferred_gender || null,
        location: settings.preferred_location || null,
        matchingMode: settings.matching_mode || 'precise',
        is_anonymous: settings.is_anonymous || 'all',
        use_anonymous: !!settings.use_anonymous,
      };
      if (settings.preferred_location) {
        const [province, city] = settings.preferred_location.split(' ');
        selectedProvince.value = province;
        selectedCity.value = city || province;
      }
    }
  } catch (error) {
    console.error('获取匹配设置失败:', error);
  }
}

async function fetchQueueCount() {
  try {
    const response = await api.get('/match/queue-count');
    if (response.data.queueCount !== undefined) {
      queueCount.value = response.data.queueCount;
    }
  } catch (error) {
    console.error('获取排队人数失败:', error);
  }
}

function updateLocation() {
  if (selectedProvince.value && selectedCity.value) {
    matchSettings.value.location = `${selectedProvince.value} ${selectedCity.value}`;
  } else {
    matchSettings.value.location = selectedProvince.value;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    const [minAge, maxAge] = matchSettings.value.ageRange;
    await api.put('/match/settings', {
      min_age: minAge,
      max_age: maxAge,
      enable_age_range: matchSettings.value.enableAgeRange,
      preferred_gender: matchSettings.value.gender || 'both',
      preferred_location: matchSettings.value.location,
      distance_range: 50,
      matching_mode: matchSettings.value.matchingMode || 'precise',
      is_anonymous: matchSettings.value.is_anonymous || 'all',
      use_anonymous: matchSettings.value.use_anonymous
    });
    // 使用新的通知方式（待后续统一，暂用原生）
    alert('匹配设置已保存');
  } catch (error) {
    console.error('保存匹配设置失败:', error);
    alert('保存失败');
  } finally {
    saving.value = false;
  }
}

async function startMatch() {
  matching.value = true;
  try {
    const [minAge, maxAge] = matchSettings.value.ageRange;
    await api.post('/match/start', {
      min_age: minAge,
      max_age: maxAge,
      enable_age_range: matchSettings.value.enableAgeRange,
      preferred_gender: matchSettings.value.gender || 'both',
      preferred_location: matchSettings.value.location,
      matching_mode: matchSettings.value.matchingMode,
      is_anonymous: matchSettings.value.is_anonymous,
      use_anonymous: matchSettings.value.use_anonymous
    });
    
    await fetchQueueCount();
    
    pollInterval.value = setInterval(async () => {
      try {
        const response = await api.get('/match/result');
        if (response.data.matched) {
          clearInterval(pollInterval.value);
          pollInterval.value = null;
          matching.value = false;
          accelerating.value = false;
          
          localStorage.setItem('matchResult', JSON.stringify({
            user: response.data.user,
            score: response.data.score,
            isAnonymous: response.data.isAnonymous || false
          }));
          
          router.push('/match/success');
        }
      } catch (error) {
        console.error('【Match】轮询错误', error);
      }
    }, 2000);
  } catch (error: any) {
    matching.value = false;
    accelerating.value = false;
    alert('匹配失败，请稍后再试');
  }
}

async function accelerateMatch() {
  accelerating.value = true;
  try {
    await api.post('/match/accelerate');
    queueJumpCount.value = queueJumpCount.value + 1;
    await fetchQueueCount();
  } catch (error: any) {
    console.error('加速匹配失败', error);
    alert(error.response?.data?.error || '加速失败');
  } finally {
    accelerating.value = false;
  }
}

async function cancelMatch() {
  if (!confirm('确定要取消匹配吗?')) return;
  
  matching.value = false;
  accelerating.value = false;
  
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }

  try {
    await api.post('/match/cancel');
  } catch (error: any) {
    console.error('取消匹配失败:', error);
  }
}

function getAccelerateCost() {
  return 2 * Math.pow(2, queueJumpCount.value);
}

function getMatchingModeDescription(mode: string) {
  const descriptions = {
    precise: '综合考虑年龄、性别、地理位置、兴趣等多维度因素进行精准匹配',
    interest: '优先匹配兴趣标签相似的用户，提高共同话题概率',
    nearby: '优先匹配同城或附近地区的用户，便于线下交流',
    random: '随机匹配，探索更多可能性'
  };
  return (descriptions as any)[mode] || '';
}

function getAnonymousDescription(mode: string) {
  const descriptions = {
    only: '匹配偏好：仅寻找同样开启了匿名匹配的用户',
    none: '匹配偏好：仅寻找未开启匿名匹配的用户',
    all: '匹配偏好：可以与任何用户匹配'
  };
  return (descriptions as any)[mode] || '';
}

async function fetchOnlineCount() {
  try {
    const response = await api.get('/online/count');
    onlineCount.value = response.data.count || 0;
  } catch (error) {
    console.error('获取在线人数失败:', error);
  }
}
</script>

<style scoped>
.animate-in {
  animation: animate-in 0.3s ease-out;
}
@keyframes animate-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>


