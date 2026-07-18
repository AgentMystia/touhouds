#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_font.py — 从 zpix.ttf 子集化出游戏用到的全部字符 → zpix-subset.woff2"""
import os, sys
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "/tmp/zpix.ttf"
if not os.path.exists(SRC):
    SRC = os.path.join(ROOT, "tools/zpix.ttf")
DST = os.path.join(ROOT, "game/assets/fonts/zpix-subset.woff2")

# 游戏全部可见文本（中文）
TEXT = """
东方夜雀求生记夜雀的歌谣与永不落幕的屋台二次创作献给永不毕业的
继续游戏新的轮回操作说明保存并回标题回到标题暂停继续
第天白天黄昏夜晚生命饥饿理智心智不稳
制作工具照明精炼生存战斗建筑服饰需要靠近河童工作台选择放置位置点击地面右键取消
攻击采集砍伐开采拾取打开添加燃料收获陷阱取餐出锅了逮住了
木箱夜雀屋台放入份食材开火米斯蒂娅亲手做的菜回复点击物品取回点击背包存入关闭
锅里放满了烹饪中陷阱逮住了一只毛玉成群结队地冲过来了远处传来窸窸窣窣的声音暴走
森林愤怒了眼神变得不对劲了有什么东西在黑暗里蠕动
草树枝燧石木头金块暗之羽毛竹筒绳木板切石斧镐鱼竿火把长枪八目鳗串棒木甲花环向日葵阳伞复苏护符
红蘑菇蓝蘑菇花瓣野人参暗之浆果生肉八目鳗蛋烤蘑菇烤肉煎蛋烤八目鳗妖精浓汤月见团子竹笋饭黑暗料理饭团膏药
蘑菇草丛树苗灯蘑菇丛太阳花岩石金矿石人参苗暗莓丛魔法树松树竹
妖精狂化毛玉怨灵森之主风见幽香露米娅雀鸟朋友
幽香收起了伞打得不错获得了狂暴化血
是这样吗黑夜很温柔哦唱歌嘛想吃天黑请闭眼送来了小礼物
肚子好饿坏掉了用坏了烧完了枯萎了碎了没有能吃的东西背包满了
吃掉了眼睛亮了起来制品放置太远了放不到那里不能放在水面上
添了把柴钓到了跑了歌声还在酝酿理智不足唱不出来夜雀之歌眩晕了敌人夜色中回荡
欢迎来到幻想乡夜里请小心脚下笑黄昏了的时间到了夜幕降临天亮了
存活击倒了做了道菜捡起那顶小小的帽子黑暗久久没有散去陨落
伤害耐久新鲜度减伤需在旁材料不够需要斧
目标活下去白天钓鱼备料主场回复理智会来做客深入太阳花田挑战四季的鲜花之主
移动自动走过去取消关闭界面选中快捷栏再点装备吃空格眩晕敌人快速第一个食物手动存档每天黎明自动
需要只在夜里发光可采黑暗回复魔
数字键帮助点击任意处
一二三四五六七八九十
0123456789×+~.%/s♪✦·…—「」【】、。，！？：（）
"""

def main():
    chars = set(TEXT)
    chars = {c for c in chars if ord(c) >= 32}
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    font = subset.load_font(SRC, opts)
    ss = subset.Subsetter(opts)
    ss.populate(text="".join(chars))
    ss.subset(font)
    font.save(DST)
    print(f"font: {DST} {os.path.getsize(DST)//1024}KB, {len(chars)} chars")

if __name__ == "__main__":
    main()
